// Roles router — manages role creation, updates, deletion, and permission mapping
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, permissionedProcedure } from './trpc';
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { doc } from '../aws';
import { loadConfig } from '../process';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

export type Permission =
  | 'team.create'
  | 'team.add_member'
  | 'team.remove_member'
  | 'team.view'
  | 'team.delete'
  | 'user.invite'
  | 'user.delete'
  | 'user.assign_roles'
  | 'role.add'
  | 'role.modify'
  | 'role.remove'
  | 'role.view'
  | 'item.create'
  | 'item.view'
  | 'item.update'
  | 'item.delete'
  | 'item.reset'
  | 'reports.create'
  | 'reports.view'
  | 'reports.delete';

export interface RoleEntity {
  PK: `ROLE#${string}`;
  SK: 'METADATA';
  roleId: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

const roleInput = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(280).optional(),
  permissions: z.array(z.string().min(1)).min(1),
});

const updateRoleInput = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(280).optional(),
  permissions: z.array(z.string().min(1)).min(1).optional(),
});

// Fetch a role from DynamoDB by ID
async function getRole(roleId: string): Promise<RoleEntity | null> {
  console.log(`[Roles] getRole start roleId=${roleId}`);

  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
    }),
  );

  const found = !!res.Item;
  console.log(`[DynamoDB] getRole found=${found}`);

  return (res.Item as RoleEntity) ?? null;
}

export const DEFAULT_ROLES: Array<
  Pick<RoleEntity, 'name' | 'description' | 'permissions'>
> = [
  {
    name: 'Owner',
    description: 'Full administrative control over the system.',
    permissions: [
      'team.create',
      'team.add_member',
      'team.remove_member',
      'team.view',
      'team.delete',
      'role.add',
      'role.modify',
      'role.remove',
      'role.view',
      'user.invite',
      'user.delete',
      'user.assign_roles',
      'item.create',
      'item.update',
      'item.delete',
      'item.view',
      'item.reset',
      'reports.create',
      'reports.view',
      'reports.delete',
    ],
  },
  {
    name: 'Manager',
    description: 'Manage members, items, and reports.',
    permissions: [
      'team.create',
      'team.add_member',
      'team.remove_member',
      'team.view',
      'item.create',
      'item.view',
      'item.update',
      'reports.create',
      'reports.view',
    ],
  },
  {
    name: 'Member',
    description: 'Limited access to view and report items.',
    permissions: ['item.view', 'reports.create', 'reports.view', 'team.view'],
  },
];

export const rolesRouter = router({
  createRole: permissionedProcedure('role.add')
    .input(roleInput)
    .mutation(async ({ input }) => {
      console.log(`[Roles] createRole start name=${input.name}`);

      const now = new Date().toISOString();
      const roleId = input.name.trim().toUpperCase();

      const existing = await getRole(roleId);
      if (existing) {
        console.log(`[Roles] createRole conflict name=${input.name}`);
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Role "${input.name}" already exists`,
        });
      }

      const role: RoleEntity = {
        PK: `ROLE#${roleId}`,
        SK: 'METADATA',
        roleId,
        name: input.name.trim(),
        description: input.description,
        permissions: input.permissions as Permission[],
        createdAt: now,
        updatedAt: now,
      };

      await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: role }));
      console.log(`[DynamoDB] Created new role ROLE#${roleId}`);

      return { success: true, role };
    }),

  getAllRoles: permissionedProcedure('role.view').query(async () => {
    console.log(`[Roles] getAllRoles start`);

    const res = await doc.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'ROLE#',
          ':sk': 'METADATA',
        },
      }),
    );

    console.log(`[DynamoDB] Scan returned ${res.Items?.length ?? 0} roles`);
    return { roles: (res.Items ?? []) as RoleEntity[] };
  }),

  getRole: protectedProcedure
    .input(z.object({ roleId: z.string().optional(), name: z.string().optional() }))
    .query(async ({ input }) => {
      console.log(`[Roles] getRole start input=${JSON.stringify(input)}`);

      if (!input.roleId && !input.name) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Provide roleId or name',
        });
      }

      const roleId = input.roleId || input.name!.toUpperCase();
      const role = await getRole(roleId);

      if (!role) {
        console.log(`[Roles] getRole not found roleId=${roleId}`);
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
      }

      return { role };
    }),

  updateRole: permissionedProcedure('role.modify')
    .input(updateRoleInput)
    .mutation(async ({ input }) => {
      console.log(`[Roles] updateRole start name=${input.name}`);

      const roleId = input.name.trim().toUpperCase();
      const existing = await getRole(roleId);

      if (!existing) {
        console.log(`[Roles] updateRole missing roleId=${roleId}`);
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
      }

      // Block editing of default roles
      const defaultNames = DEFAULT_ROLES.map((r) => r.name.toUpperCase());
      if (defaultNames.includes(roleId)) {
        console.log(`[Roles] updateRole forbidden default=${roleId}`);
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot modify default roles' });
      }

      const now = new Date().toISOString();
      const values: Record<string, any> = { ':updatedAt': now };
      const attrNames: Record<string, string> = {};
      const sets: string[] = ['updatedAt = :updatedAt'];

      if (input.name && input.name !== existing.name) {
        sets.push('#name = :name');
        attrNames['#name'] = 'name';
        values[':name'] = input.name.trim();
      }
      if (typeof input.description !== 'undefined') {
        sets.push('description = :desc');
        values[':desc'] = input.description ?? '';
      }
      if (input.permissions) {
        sets.push('#permissions = :perms');
        attrNames['#permissions'] = 'permissions';
        values[':perms'] = input.permissions as Permission[];
      }

      const updated = await doc.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
          UpdateExpression: `SET ${sets.join(', ')}`,
          ExpressionAttributeNames: Object.keys(attrNames).length ? attrNames : undefined,
          ExpressionAttributeValues: values,
          ReturnValues: 'ALL_NEW',
        }),
      );

      console.log(`[DynamoDB] Updated ROLE#${roleId}`);
      return { success: true, role: updated.Attributes as RoleEntity };
    }),

  deleteRole: permissionedProcedure('role.remove')
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const roleId = input.name.trim().toUpperCase();
      console.log(`[Roles] deleteRole start roleId=${roleId}`);

      const role = await getRole(roleId);
      if (!role) {
        console.log(`[Roles] deleteRole no-op role missing`);
        return { success: true, deleted: false };
      }

      // Block deleting default roles
      const defaultNames = DEFAULT_ROLES.map((r) => r.name.toUpperCase());
      if (defaultNames.includes(roleId)) {
        console.log(`[Roles] deleteRole forbidden default=${roleId}`);
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete default roles' });
      }

      await doc.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
        }),
      );

      console.log(`[DynamoDB] Deleted ROLE#${roleId}`);
      return { success: true, deleted: true };
    }),
});
