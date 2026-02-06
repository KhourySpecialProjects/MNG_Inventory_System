// Handles inventory items
import { z } from 'zod';
import { router, publicProcedure, permissionedProcedure, protectedProcedure } from './trpc';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { doc } from '../aws';
import { loadConfig } from '../process';
import { TRPCError } from '@trpc/server';
import { isLocalDev } from '../localDev';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;
const BUCKET_NAME = config.BUCKET_NAME;
const REGION = config.REGION;
const KMS_KEY_ARN = config.KMS_KEY_ARN;

// In-memory image store for local dev
const localItemImages = new Map<string, string>();

if (!isLocalDev && !BUCKET_NAME) throw new Error('❌ Missing S3 bucket name');
const s3 = isLocalDev ? null : new S3Client({ region: REGION });

// creates an ID for the item
function newId(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString('base64')
    .replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] as string);
}

// getting image extension
function getImageExtension(base64: string): string {
  const m = base64.match(/^data:image\/(\w+);base64,/);
  return m ? m[1].toLowerCase() : 'png';
}

// remove the base64 Header
function stripBase64Header(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, '');
}

// geting the user username
async function getUserName(userId: string): Promise<string | undefined> {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    }),
  );

  return res.Item?.name;
}

// getting a presigned URL
async function getPresignedUrl(imageKey?: string): Promise<string | undefined> {
  if (!imageKey) return undefined;

  // Local dev mode: return from memory store
  if (isLocalDev) {
    const image = localItemImages.get(imageKey);
    if (image) {
      console.log(`[LocalDev] Retrieved item image: ${imageKey} (size: ${image.length} chars)`);
    } else {
      console.log(`[LocalDev] No image found for key: ${imageKey}`);
    }
    return image || undefined;
  }

  const url = await getSignedUrl(
    s3!,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey,
    }),
    { expiresIn: 3600 },
  );

  return url;
}

// Helper to upload image (handles local dev)
async function uploadImage(key: string, base64Data: string, contentType: string): Promise<void> {
  if (isLocalDev) {
    // Store the full base64 data URL (with header) for local retrieval
    // This ensures the browser can display it directly
    if (!base64Data.startsWith('data:')) {
      // If it doesn't have a header, add it
      base64Data = `data:${contentType};base64,${base64Data}`;
    }
    localItemImages.set(key, base64Data);
    console.log(`[LocalDev] Stored item image: ${key} (size: ${base64Data.length} chars)`);
    return;
  }

  const buffer = Buffer.from(stripBase64Header(base64Data), 'base64');
  await s3!.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ...(KMS_KEY_ARN ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: KMS_KEY_ARN } : {}),
    }),
  );
}

export const itemsRouter = router({
  /** CREATE ITEM **/
  createItem: permissionedProcedure('item.create')
    .input(
      z.object({
        teamId: z.string(),
        name: z.string(),
        actualName: z.string().optional().nullable(),
        userId: z.string(),
        status: z.string().optional(),
        imageBase64: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        parent: z.string().optional().nullable(),
        isKit: z.boolean().optional(),

        // item fields
        nsn: z.string().optional().nullable(),
        serialNumber: z.string().optional().nullable(),
        authQuantity: z.number().optional().nullable(),
        ohQuantity: z.number().optional().nullable(),

        // kit fields
        liin: z.string().optional().nullable(),
        endItemNiin: z.string().optional().nullable(),
        damageReports: z.array(z.string()).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const existing = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `TEAM#${input.teamId}`,
              ':sk': 'ITEM#',
            },
          }),
        );

        const duplicate = (existing.Items ?? []).find((it: any) => {
          // For kits, check endItemNiin uniqueness
          if (input.isKit && input.endItemNiin && it.isKit && it.endItemNiin) {
            return it.endItemNiin.trim().toLowerCase() === input.endItemNiin.trim().toLowerCase();
          }
          // For items, check NSN uniqueness
          if (!input.isKit && input.nsn && !it.isKit && it.nsn) {
            return it.nsn.trim().toLowerCase() === input.nsn.trim().toLowerCase();
          }
          return false;
        });

        if (duplicate) {
          const field = input.isKit ? 'End Item NIIN' : 'NSN';
          const value = input.isKit ? input.endItemNiin : input.nsn;
          throw new TRPCError({
            code: 'CONFLICT',
            message: `A ${input.isKit ? 'kit' : 'item'} with ${field} "${value}" already exists.`,
          });
        }

        const itemId = newId(12);
        const now = new Date().toISOString();

        let imageKey: string | undefined;

        if (input.imageBase64) {
        const ext = getImageExtension(input.imageBase64);
        const identifier = input.nsn || input.liin || input.endItemNiin || itemId;
        imageKey = `items/${input.teamId}/${identifier}.${ext}`;
        await uploadImage(imageKey, input.imageBase64, `image/${ext}`);
}

        const userName = await getUserName(input.userId);

        const item = {
          PK: `TEAM#${input.teamId}`,
          SK: `ITEM#${itemId}`,
          Type: 'Item',

          // identifiers
          teamId: input.teamId,
          itemId,

          // base fields
          name: input.name,
          actualName: input.actualName ?? undefined,
          description: input.description ?? undefined,
          status: input.status ?? 'To Review',
          parent: input.parent ?? null,
          isKit: input.isKit ?? false,

          // item fields
          nsn: input.nsn,
          serialNumber: input.serialNumber ?? undefined,
          authQuantity: input.authQuantity ?? 1,
          ohQuantity: input.ohQuantity ?? 1,

          // kit fields
          liin: input.liin ?? '',
          endItemNiin: input.endItemNiin ?? '',

          // image + reports
          imageKey,
          damageReports: input.damageReports ?? [],

          // metadata
          createdAt: now,
          updatedAt: now,
          createdBy: input.userId,

          updateLog: [
            {
              userId: input.userId,
              userName: userName ?? 'Unknown',
              action: 'create',
              timestamp: now,
            },
          ],
        };

        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
        return { success: true, itemId, item };
      } catch (err: any) {
        // If it's already a TRPCError, re-throw it
        if (err.name === 'TRPCError') throw err;

        // Otherwise wrap it
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to create item',
        });
      }
    }),

  getItems: permissionedProcedure('item.view')
    .input(z.object({ teamId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `TEAM#${input.teamId}`,
              ':sk': 'ITEM#',
            },
          }),
        );

        const rawItems = result.Items ?? [];

        const items = await Promise.all(
          rawItems.map(async (raw: any) => {
            const signed = await getPresignedUrl(raw.imageKey);

            let parentName: string | null = null;

            if (raw.parent) {
              const parentRes = await doc.send(
                new GetCommand({
                  TableName: TABLE_NAME,
                  Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${raw.parent}` },
                }),
              );
              parentName = parentRes.Item?.name ?? null;
            }

            // Get the last reviewer from updateLog
            let lastReviewedBy: string | null = null;
            let lastReviewedByName: string | null = null;

            if (raw.updateLog && Array.isArray(raw.updateLog) && raw.updateLog.length > 0) {
              const lastUpdate = raw.updateLog[raw.updateLog.length - 1];
              lastReviewedBy = lastUpdate.userId ?? null;
              lastReviewedByName = lastUpdate.userName ?? null;
            }

            return { ...raw, imageLink: signed, parentName, lastReviewedBy, lastReviewedByName };
          }),
        );

        return { success: true, items };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  getItem: permissionedProcedure('item.view')
    .input(
      z.object({
        teamId: z.string(),
        itemId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: `TEAM#${input.teamId}`,
              SK: `ITEM#${input.itemId}`,
            },
          }),
        );

        if (!result.Item) return { success: false, error: 'Item not found' };

        const signed = await getPresignedUrl(result.Item.imageKey);

        return {
          success: true,
          item: { ...result.Item, imageLink: signed },
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  updateItem: permissionedProcedure('item.update')
    .input(
      z.object({
        teamId: z.string(),
        itemId: z.string(),
        userId: z.string(),

        name: z.string().optional().nullable(),
        actualName: z.string().optional().nullable(),
        nsn: z.string().optional().nullable(),
        serialNumber: z.string().optional().nullable(),
        authQuantity: z.number().optional().nullable(),
        ohQuantity: z.number().optional().nullable(),

        description: z.string().optional().nullable(),
        imageBase64: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        damageReports: z.array(z.string()).optional().nullable(),
        parent: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),

        // kit fields
        liin: z.string().optional().nullable(),
        endItemNiin: z.string().optional().nullable(),
        isKit: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const now = new Date().toISOString();

        const updates: string[] = ['updatedAt = :updatedAt'];
        const values: Record<string, any> = { ':updatedAt': now };
        const names: Record<string, string> = {};

        const push = (key: string, val: any, fieldName?: string) => {
          if (val !== undefined && val !== null) {
            updates.push(`${fieldName || key} = :${key}`);
            values[`:${key}`] = val;
            if (key === 'name' || key === 'status') names[`#${key}`] = key;
          }
        };

        // new image upload
          if (input.imageBase64) {
            const ext = getImageExtension(input.imageBase64);
            const identifier = input.nsn || input.liin || input.endItemNiin || input.itemId;
            const newKey = `items/${input.teamId}/${identifier}.${ext}`;
            await uploadImage(newKey, input.imageBase64, `image/${ext}`);

            updates.push('imageKey = :imageKey');
            values[':imageKey'] = newKey;
}
        // base fields
        push('name', input.name, '#name');
        push('actualName', input.actualName);
        push('description', input.description);
        push('status', input.status, '#status');
        push('parent', input.parent);
        push('notes', input.notes);
        push('isKit', input.isKit);

        // item fields
        push('nsn', input.nsn);
        push('serialNumber', input.serialNumber);
        push('authQuantity', input.authQuantity);
        push('ohQuantity', input.ohQuantity);

        // kit fields
        push('liin', input.liin);
        push('endItemNiin', input.endItemNiin);

        // arrays
        push('damageReports', input.damageReports);

        // update log
        updates.push('updateLog = list_append(if_not_exists(updateLog, :empty), :log)');
        const userName = await getUserName(input.userId);
        values[':log'] = [
          {
            userId: input.userId,
            userName: userName ?? 'Unknown',
            action: 'update',
            timestamp: now,
          },
        ];
        values[':empty'] = [];

        const result = await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${input.itemId}` },
            UpdateExpression: `SET ${updates.join(', ')}`,
            ExpressionAttributeValues: values,
            ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
            ReturnValues: 'ALL_NEW',
          }),
        );

        const attrs = result.Attributes;
        const signed = await getPresignedUrl(attrs?.imageKey);

        let parentName = null;
        if (attrs?.parent) {
          const parentRes = await doc.send(
            new GetCommand({
              TableName: TABLE_NAME,
              Key: { PK: `TEAM#${input.teamId}`, SK: `ITEM#${attrs.parent}` },
            }),
          );
          parentName = parentRes.Item?.name ?? null;
        }

        return {
          success: true,
          item: { ...attrs, imageLink: signed, parentName },
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  deleteItem: permissionedProcedure('item.delete')
    .input(
      z.object({
        teamId: z.string(),
        itemId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const key = {
          PK: `TEAM#${input.teamId}`,
          SK: `ITEM#${input.itemId}`,
        };

        const getRes = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: key,
          }),
        );

        if (!getRes.Item) return { success: false, error: 'Item not found' };

        if (getRes.Item.imageKey) {
          if (isLocalDev) {
            localItemImages.delete(getRes.Item.imageKey);
          } else {
            await s3!.send(
              new (await import('@aws-sdk/client-s3')).DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: getRes.Item.imageKey,
              }),
            );
          }
        }

        await doc.send(
          new (await import('@aws-sdk/lib-dynamodb')).DeleteCommand({
            TableName: TABLE_NAME,
            Key: key,
          }),
        );

        return { success: true, message: 'Item deleted successfully' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),
  uploadImage: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        nsn: z.string(),
        imageBase64: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const ext = getImageExtension(input.imageBase64);
        const key = `items/${input.teamId}/${input.nsn}.${ext}`;
        await uploadImage(key, input.imageBase64, `image/${ext}`);
        return { success: true, imageKey: key };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  getAllItemsByNSN: protectedProcedure
    .input(
      z.object({
        nsn: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Get all teams the user has access to
        const userTeamsResult = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI_UserTeams',
            KeyConditionExpression: 'GSI1PK = :gsi1pk',
            ExpressionAttributeValues: {
              ':gsi1pk': `USER#${input.userId}`,
            },
          }),
        );

        const teamIds = (userTeamsResult.Items ?? [])
          .filter((item: any) => item.Type === 'TeamMember')
          .map((item: any) => item.teamId);

        // Search for items with matching NSN across all teams
        const allItems: any[] = [];

        for (const teamId of teamIds) {
          const result = await doc.send(
            new QueryCommand({
              TableName: TABLE_NAME,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
              ExpressionAttributeValues: {
                ':pk': `TEAM#${teamId}`,
                ':sk': 'ITEM#',
              },
            }),
          );

          const items = (result.Items ?? []).filter((item: any) => {
            if (!item.nsn || item.isKit) return false;
            return item.nsn.toLowerCase().includes(input.nsn.toLowerCase());
          });

          // Get team name
          const teamMetaRes = await doc.send(
            new GetCommand({
              TableName: TABLE_NAME,
              Key: {
                PK: `TEAM#${teamId}`,
                SK: 'METADATA',
              },
            }),
          );
          const teamName = teamMetaRes.Item?.GSI_NAME ?? teamMetaRes.Item?.name ?? teamId;

          // Add presigned URLs for images and team name
          const itemsWithImages = await Promise.all(
            items.map(async (item: any) => {
              const imageLink = await getPresignedUrl(item.imageKey);
              return {
                ...item,
                teamId,
                teamName,
                imageLink,
              };
            }),
          );

          allItems.push(...itemsWithImages);
        }

        return { success: true, items: allItems };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),
});

export type ItemsRouter = typeof itemsRouter;
