// Users router — manages listing, assigning roles, and deleting users
import { z } from 'zod';
import { router, publicProcedure, permissionedProcedure } from './trpc';
import {
  ScanCommand,
  UpdateCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { doc } from '../aws';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { loadConfig } from '../process';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

export const usersRouter = router({
  // List all users with roles
  listUsersWithRoles: permissionedProcedure('user.assign_roles').query(async () => {
    console.log(`[Users] listUsersWithRoles start`);

    const usersRes = await doc.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'USER#',
          ':sk': 'METADATA',
        },
      }),
    );

    console.log(`[DynamoDB] Scan returned ${usersRes.Items?.length ?? 0} users`);

    const users = (usersRes.Items ?? []).map((user) => ({
      userId: user.sub,
      username: user.username ?? 'Unknown',
      name: user.name ?? 'Unknown User',
      roleName: user.role ?? 'No Role',
    }));

    return { users };
  }),

  // Assign role to user
  assignRole: permissionedProcedure('user.assign_roles')
    .input(
      z.object({
        userId: z.string(),
        roleName: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      console.log(`[Users] assignRole user=${input.userId} role=${input.roleName}`);

      const now = new Date().toISOString();
      const roleId = input.roleName.toUpperCase();

      const roleRes = await doc.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: `ROLE#${roleId}`, SK: 'METADATA' },
        }),
      );

      console.log(`[DynamoDB] Role lookup ROLE#${roleId}: ${!!roleRes.Item}`);

      if (!roleRes.Item) throw new Error('Role not found');

      await doc.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${input.userId}`,
            SK: 'METADATA',
          },
          UpdateExpression: 'SET #role = :roleName, updatedAt = :now',
          ExpressionAttributeNames: {
            '#role': 'role',
          },
          ExpressionAttributeValues: {
            ':roleName': input.roleName,
            ':now': now,
          },
        }),
      );

      console.log(
        `[DynamoDB] Updated USER#${input.userId} role -> ${input.roleName}`
      );

      return { success: true, roleName: input.roleName };
    }),

  // Get a user's role
  getUserRole: permissionedProcedure('user.assign_roles')
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      console.log(`[Users] getUserRole user=${input.userId}`);

      const userRes = await doc.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${input.userId}`, SK: 'METADATA' },
        }),
      );

      const user = userRes.Item;
      console.log(`[DynamoDB] Get USER#${input.userId}: ${!!user}`);

      if (!user) throw new Error('User not found');

      return {
        userId: input.userId,
        roleName: user.role ?? 'No Role',
      };
    }),

  // Delete user + avatar + team relations
  deleteUser: permissionedProcedure('user.delete')
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const { userId } = input;
      console.log(`[Users] deleteUser start user=${userId}`);

      const s3Client = new S3Client({ region: config.REGION });

      const exts = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
      const prefix = `Profile/${userId}`;

      // Delete S3 profile images
      for (const ext of exts) {
        const key = `${prefix}.${ext}`;

        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: config.BUCKET_NAME,
              Key: key,
            }),
          );
          console.log(`[S3] Deleted ${key}`);
        } catch (err) {
          console.log(`[S3] Skip missing ${key}`);
        }
      }

      // Delete user METADATA
      await doc.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `USER#${userId}`,
            SK: 'METADATA',
          },
        }),
      );

      console.log(`[DynamoDB] Deleted USER#${userId} METADATA`);

      // Query all user-team relations
      const userTeams = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
          },
        }),
      );

      console.log(
        `[DynamoDB] Found ${userTeams.Items?.length ?? 0} team relations for USER#${userId}`
      );

      // Delete user+team relations
      for (const item of userTeams.Items ?? []) {
        await doc.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: item.PK,
              SK: item.SK,
            },
          }),
        );
        console.log(`[DynamoDB] Deleted relation PK=${item.PK} SK=${item.SK}`);
      }

      console.log(`[Users] deleteUser complete user=${userId}`);

      return { success: true };
    }),
});