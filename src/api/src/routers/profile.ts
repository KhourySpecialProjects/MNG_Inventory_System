// Profile router — handles authenticated profile fetch + profile updates
import { z } from 'zod';
import { router, protectedProcedure } from './trpc';
import { TRPCError } from '@trpc/server';
import { loadConfig } from '../process';
import { doc } from '../aws';
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;

// Generate a random username base
function randomUsername(): string {
  return 'user-' + Math.random().toString(36).substring(2, 8);
}

// Ensure username uniqueness across GSI_UsersByUsername
async function ensureUniqueUsername(base: string): Promise<string> {
  let username = base;
  let counter = 1;

  while (true) {
    const res = await doc.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI_UsersByUsername',
        KeyConditionExpression: 'username = :u',
        ExpressionAttributeValues: { ':u': username },
        Limit: 1,
      }),
    );

    if (!res.Items || res.Items.length === 0) return username;

    username = `${base}${counter}`;
    counter++;
  }
}

export const profileRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const userCtx = ctx.user;
    if (!userCtx) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No session' });

    const userId = userCtx.userId;
    console.log(`[Profile] getProfile start userId=${userId}`);

    try {
      // Get profile record
      const userRes = await doc.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: 'METADATA' },
        }),
      );

      let user = userRes.Item;

      // Auto-create user if missing
      if (!user) {
        console.log(`[Profile] Creating new user record userId=${userId}`);

        const now = new Date().toISOString();
        const generated = await ensureUniqueUsername(randomUsername());

        user = {
          PK: `USER#${userId}`,
          SK: 'METADATA',
          sub: userId,
          username: generated,
          name: generated,
          role: 'User',
          createdAt: now,
          updatedAt: now,
          GSI6PK: `UID#${userId}`,
          GSI6SK: `USER#${userId}`,
        };

        await doc.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: user,
          }),
        );

        console.log(`[DynamoDB] Created USER#${userId}`);
      }

      // Lookup team from GSI_UserTeams
      const teamRes = await doc.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI_UserTeams',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: { ':pk': `USER#${userId}` },
          Limit: 1,
        }),
      );

      const teamItem = teamRes.Items?.[0];
      const teamName = teamItem?.teamName ?? 'No Team Assigned';

      console.log(
        `[Profile] Returning profile userId=${userId} username=${user.username} team=${teamName}`,
      );

      return {
        authenticated: true,
        userId,
        username: user.username,
        name: user.name,
        role: user.role,
        team: teamName,
      };
    } catch (err) {
      console.error('❌ getProfile error:', err);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch profile',
      });
    }
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().optional(),
        username: z.string().optional(),
        role: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const callerId = ctx.user?.userId;
      if (!callerId)
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Missing user in context',
        });
      if (callerId !== input.userId)
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot update another user',
        });

      console.log(`[Profile] updateProfile start userId=${input.userId}`);

      try {
        const existing = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${input.userId}`, SK: 'METADATA' },
          }),
        );

        if (!existing.Item) {
          console.log(`[Profile] updateProfile user not found userId=${input.userId}`);
          return { success: false, message: 'User not found' };
        }

        const updates: string[] = [];
        const vars: Record<string, any> = {};
        const names: Record<string, string> = {};

        // Username change
        if (
          input.username &&
          input.username.trim() &&
          input.username.trim() !== existing.Item.username
        ) {
          const clean = input.username.trim().replace(/[^a-zA-Z0-9_-]/g, '');
          const unique = await ensureUniqueUsername(clean);
          updates.push('#un = :username');
          names['#un'] = 'username';
          vars[':username'] = unique;
          console.log(`[Profile] username updated -> ${unique}`);
        }

        // Name change
        if (input.name && input.name.trim() && input.name.trim() !== existing.Item.name) {
          updates.push('#nm = :name');
          names['#nm'] = 'name';
          vars[':name'] = input.name.trim();
          console.log(`[Profile] name updated -> ${input.name.trim()}`);
        }

        // Role change
        if (input.role && input.role.trim() && input.role !== existing.Item.role) {
          updates.push('#rl = :role');
          names['#rl'] = 'role';
          vars[':role'] = input.role.trim();
          console.log(`[Profile] role updated -> ${input.role.trim()}`);
        }

        // Nothing to update
        if (updates.length === 0) {
          console.log('[Profile] No changes to update');
          return { success: true, message: 'No changes' };
        }

        // Always update updatedAt
        updates.push('updatedAt = :updatedAt');
        vars[':updatedAt'] = new Date().toISOString();

        await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `USER#${input.userId}`, SK: 'METADATA' },
            UpdateExpression: `SET ${updates.join(', ')}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: vars,
          }),
        );

        console.log(`[DynamoDB] updateProfile success userId=${input.userId}`);

        return { success: true, message: 'Profile updated' };
      } catch (err) {
        console.error('❌ updateProfile error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update profile',
        });
      }
    }),
});
