// Handles inventory templates
import { z } from 'zod';
import { router, permissionedProcedure } from './trpc';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { doc } from '../aws';
import { loadConfig } from '../process';
import { TRPCError } from '@trpc/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isLocalDev } from '../localDev';

const config = loadConfig();
const TABLE_NAME = config.TABLE_NAME;
const BUCKET_NAME = config.BUCKET_NAME;
const REGION = config.REGION;
const KMS_KEY_ARN = config.KMS_KEY_ARN;

// In-memory image store for local dev
const localTemplateImages = new Map<string, string>();

const s3 = isLocalDev ? null : new S3Client({ region: REGION });

function getImageExtension(base64: string): string {
  const m = base64.match(/^data:image\/(\w+);base64,/);
  return m ? m[1].toLowerCase() : 'png';
}

function stripBase64Header(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, '');
}

async function uploadImage(key: string, base64Data: string, contentType: string): Promise<void> {
  if (isLocalDev) {
    if (!base64Data.startsWith('data:')) {
      base64Data = `data:${contentType};base64,${base64Data}`;
    }
    localTemplateImages.set(key, base64Data);
    console.log(`[LocalDev] Stored template image: ${key} (size: ${base64Data.length} chars)`);
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

async function getPresignedUrl(imageKey?: string): Promise<string | undefined> {
  if (!imageKey) return undefined;

  if (isLocalDev) {
    return localTemplateImages.get(imageKey) || undefined;
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

function newId(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString('base64')
    .replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c] as string);
}

async function getUserName(userId: string): Promise<string | undefined> {
  const res = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    }),
  );
  return res.Item?.name;
}

export const templatesRouter = router({
  /** CREATE TEMPLATE **/
  createTemplate: permissionedProcedure('template.create')
    .input(
      z.object({
        userId: z.string(),
        name: z.string(),
        description: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const templateId = newId(12);
        const now = new Date().toISOString();
        const userName = await getUserName(input.userId);

        const template = {
          PK: `TEMPLATE#${templateId}`,
          SK: 'METADATA',
          Type: 'Template',

          templateId,
          name: input.name,
          description: input.description ?? null,
          status: 'draft',

          // GSI for listing all templates
          GSI1PK: 'ALL_TEMPLATES',
          GSI1SK: now,

          createdBy: input.userId,
          createdAt: now,
          updatedAt: now,

          updateLog: [
            {
              userId: input.userId,
              userName: userName ?? 'Unknown',
              action: 'create',
              timestamp: now,
            },
          ],
        };

        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: template }));
        return { success: true, templateId, template };
      } catch (err: any) {
        if (err.name === 'TRPCError') throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to create template',
        });
      }
    }),

  /** GET ALL TEMPLATES **/
  getTemplates: permissionedProcedure('template.view')
    .input(z.object({ userId: z.string() }))
    .query(async () => {
      try {
        const result = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI_UserTeams',
            KeyConditionExpression: 'GSI1PK = :gsi1pk',
            ExpressionAttributeValues: {
              ':gsi1pk': 'ALL_TEMPLATES',
            },
          }),
        );

        const templates = result.Items ?? [];
        return { success: true, templates };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  /** GET SINGLE TEMPLATE **/
  getTemplate: permissionedProcedure('template.view')
    .input(z.object({ templateId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
          }),
        );

        if (!result.Item) return { success: false, error: 'Template not found' };
        return { success: true, template: result.Item };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  /** UPDATE TEMPLATE METADATA **/
  updateTemplate: permissionedProcedure('template.update')
    .input(
      z.object({
        templateId: z.string(),
        userId: z.string(),
        name: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const now = new Date().toISOString();
        const updates: string[] = ['updatedAt = :updatedAt'];
        const values: Record<string, any> = { ':updatedAt': now };
        const names: Record<string, string> = {};

        if (input.name !== undefined) {
          updates.push('#name = :name');
          values[':name'] = input.name;
          names['#name'] = 'name';
        }
        if (input.description !== undefined) {
          updates.push('description = :description');
          values[':description'] = input.description ?? null;
        }

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
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
            UpdateExpression: `SET ${updates.join(', ')}`,
            ExpressionAttributeValues: values,
            ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
            ReturnValues: 'ALL_NEW',
          }),
        );

        return { success: true, template: result.Attributes };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  /** DELETE TEMPLATE **/
  deleteTemplate: permissionedProcedure('template.delete')
    .input(z.object({ templateId: z.string(), userId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        // Check template exists
        const existing = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
          }),
        );
        if (!existing.Item) return { success: false, error: 'Template not found' };

        // Delete all template items first
        const itemsResult = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `TEMPLATE#${input.templateId}`,
              ':sk': 'ITEM#',
            },
          }),
        );

        for (const item of itemsResult.Items ?? []) {
          await doc.send(
            new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { PK: item.PK, SK: item.SK },
            }),
          );
        }

        // Delete template metadata
        await doc.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
          }),
        );

        return { success: true, message: 'Template deleted successfully' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  /** ADD ITEM TO TEMPLATE **/
  addItemToTemplate: permissionedProcedure('template.update')
    .input(
      z.object({
        templateId: z.string(),
        userId: z.string(),

        // base fields
        name: z.string(),
        actualName: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        isKit: z.boolean().optional(),
        parent: z.string().optional().nullable(),

        // item fields (no serialNumber, no quantities)
        nsn: z.string().optional().nullable(),
        liin: z.string().optional().nullable(),
        endItemNiin: z.string().optional().nullable(),
        imageBase64: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Verify template exists
        const templateRes = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
          }),
        );
        if (!templateRes.Item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
        }

        const templateItemId = newId(12);
        const now = new Date().toISOString();

        let imageKey: string | undefined;
        if (input.imageBase64) {
          const ext = getImageExtension(input.imageBase64);
          const identifier = input.nsn || input.liin || input.endItemNiin || templateItemId;
          imageKey = `templates/${input.templateId}/${identifier}.${ext}`;
          await uploadImage(imageKey, input.imageBase64, `image/${ext}`);
        }

        const templateItem = {
          PK: `TEMPLATE#${input.templateId}`,
          SK: `ITEM#${templateItemId}`,
          Type: 'TemplateItem',

          templateId: input.templateId,
          templateItemId,

          // base fields
          name: input.name,
          actualName: input.actualName ?? null,
          description: input.description ?? null,
          isKit: input.isKit ?? false,
          parent: input.parent ?? null,

          // item fields — no serialNumber, no quantities
          nsn: input.nsn ?? null,
          liin: input.liin ?? null,
          endItemNiin: input.endItemNiin ?? null,
          imageKey,

          createdBy: input.userId,
          createdAt: now,
          updatedAt: now,
        };

        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: templateItem }));

        // Bump template updatedAt
        const userName = await getUserName(input.userId);
        await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
            UpdateExpression:
              'SET updatedAt = :now, updateLog = list_append(if_not_exists(updateLog, :empty), :log)',
            ExpressionAttributeValues: {
              ':now': now,
              ':log': [
                {
                  userId: input.userId,
                  userName: userName ?? 'Unknown',
                  action: 'add_item',
                  timestamp: now,
                },
              ],
              ':empty': [],
            },
          }),
        );

        return { success: true, templateItemId, templateItem };
      } catch (err: any) {
        if (err.name === 'TRPCError') throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to add item to template',
        });
      }
    }),

  /** CREATE TEMPLATE ITEM (brand-new, not sourced from a team) **/
  createTemplateItem: permissionedProcedure('template.update')
    .input(
      z.object({
        templateId: z.string(),
        userId: z.string(),

        // base fields
        name: z.string(),
        actualName: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        isKit: z.boolean().optional(),
        parent: z.string().optional().nullable(),

        // item fields (no serialNumber, no quantities, no status)
        nsn: z.string().optional().nullable(),
        liin: z.string().optional().nullable(),
        endItemNiin: z.string().optional().nullable(),
        imageBase64: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Verify template exists
        const templateRes = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
          }),
        );
        if (!templateRes.Item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
        }

        const templateItemId = newId(12);
        const now = new Date().toISOString();

        let imageKey: string | undefined;
        if (input.imageBase64) {
          const ext = getImageExtension(input.imageBase64);
          const identifier = input.nsn || input.liin || input.endItemNiin || templateItemId;
          imageKey = `templates/${input.templateId}/${identifier}.${ext}`;
          await uploadImage(imageKey, input.imageBase64, `image/${ext}`);
        }

        const templateItem = {
          PK: `TEMPLATE#${input.templateId}`,
          SK: `ITEM#${templateItemId}`,
          Type: 'TemplateItem',

          templateId: input.templateId,
          templateItemId,

          name: input.name,
          actualName: input.actualName ?? null,
          description: input.description ?? null,
          isKit: input.isKit ?? false,
          parent: input.parent ?? null,

          // no serialNumber, no quantities, no status
          nsn: input.nsn ?? null,
          liin: input.liin ?? null,
          endItemNiin: input.endItemNiin ?? null,
          imageKey,

          createdBy: input.userId,
          createdAt: now,
          updatedAt: now,
        };

        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: templateItem }));

        // Bump template updatedAt
        const userName = await getUserName(input.userId);
        await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
            UpdateExpression:
              'SET updatedAt = :now, updateLog = list_append(if_not_exists(updateLog, :empty), :log)',
            ExpressionAttributeValues: {
              ':now': now,
              ':log': [
                {
                  userId: input.userId,
                  userName: userName ?? 'Unknown',
                  action: 'create_item',
                  timestamp: now,
                },
              ],
              ':empty': [],
            },
          }),
        );

        return { success: true, templateItemId, templateItem };
      } catch (err: any) {
        if (err.name === 'TRPCError') throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to create template item',
        });
      }
    }),

  /** UPDATE TEMPLATE ITEM **/
  updateTemplateItem: permissionedProcedure('template.update')
    .input(
      z.object({
        templateId: z.string(),
        templateItemId: z.string(),
        userId: z.string(),

        name: z.string().optional(),
        actualName: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        isKit: z.boolean().optional(),
        parent: z.string().optional().nullable(),

        nsn: z.string().optional().nullable(),
        liin: z.string().optional().nullable(),
        endItemNiin: z.string().optional().nullable(),
        imageBase64: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const key = {
          PK: `TEMPLATE#${input.templateId}`,
          SK: `ITEM#${input.templateItemId}`,
        };

        const existing = await doc.send(new GetCommand({ TableName: TABLE_NAME, Key: key }));
        if (!existing.Item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Template item not found' });
        }

        const now = new Date().toISOString();
        const updates: string[] = ['updatedAt = :updatedAt'];
        const values: Record<string, any> = { ':updatedAt': now };
        const names: Record<string, string> = {};

        if (input.name !== undefined) {
          updates.push('#name = :name');
          values[':name'] = input.name;
          names['#name'] = 'name';
        }
        if (input.actualName !== undefined) {
          updates.push('actualName = :actualName');
          values[':actualName'] = input.actualName ?? null;
        }
        if (input.description !== undefined) {
          updates.push('description = :description');
          values[':description'] = input.description ?? null;
        }
        if (input.isKit !== undefined) {
          updates.push('isKit = :isKit');
          values[':isKit'] = input.isKit;
        }
        if (input.parent !== undefined) {
          updates.push('parent = :parent');
          values[':parent'] = input.parent ?? null;
        }
        if (input.nsn !== undefined) {
          updates.push('nsn = :nsn');
          values[':nsn'] = input.nsn ?? null;
        }
        if (input.liin !== undefined) {
          updates.push('liin = :liin');
          values[':liin'] = input.liin ?? null;
        }
        if (input.endItemNiin !== undefined) {
          updates.push('endItemNiin = :endItemNiin');
          values[':endItemNiin'] = input.endItemNiin ?? null;
        }

        // Handle image update
        if (input.imageBase64 !== undefined) {
          if (input.imageBase64) {
            const ext = getImageExtension(input.imageBase64);
            const identifier = input.nsn || input.liin || input.endItemNiin || input.templateItemId;
            const imageKey = `templates/${input.templateId}/${identifier}.${ext}`;
            await uploadImage(imageKey, input.imageBase64, `image/${ext}`);
            updates.push('imageKey = :imageKey');
            values[':imageKey'] = imageKey;
          } else {
            updates.push('imageKey = :imageKey');
            values[':imageKey'] = null;
          }
        }

        const result = await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: key,
            UpdateExpression: `SET ${updates.join(', ')}`,
            ExpressionAttributeValues: values,
            ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
            ReturnValues: 'ALL_NEW',
          }),
        );

        // Bump template updatedAt
        const userName = await getUserName(input.userId);
        await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
            UpdateExpression:
              'SET updatedAt = :now, updateLog = list_append(if_not_exists(updateLog, :empty), :log)',
            ExpressionAttributeValues: {
              ':now': now,
              ':log': [
                {
                  userId: input.userId,
                  userName: userName ?? 'Unknown',
                  action: 'update_item',
                  timestamp: now,
                },
              ],
              ':empty': [],
            },
          }),
        );

        return { success: true, templateItem: result.Attributes };
      } catch (err: any) {
        if (err.name === 'TRPCError') throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to update template item',
        });
      }
    }),

  /** REMOVE ITEM FROM TEMPLATE **/
  removeItemFromTemplate: permissionedProcedure('template.update')
    .input(
      z.object({
        templateId: z.string(),
        templateItemId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const key = {
          PK: `TEMPLATE#${input.templateId}`,
          SK: `ITEM#${input.templateItemId}`,
        };

        const existing = await doc.send(new GetCommand({ TableName: TABLE_NAME, Key: key }));
        if (!existing.Item) return { success: false, error: 'Template item not found' };

        await doc.send(new DeleteCommand({ TableName: TABLE_NAME, Key: key }));

        // Bump template updatedAt
        const now = new Date().toISOString();
        const userName = await getUserName(input.userId);
        await doc.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TEMPLATE#${input.templateId}`, SK: 'METADATA' },
            UpdateExpression:
              'SET updatedAt = :now, updateLog = list_append(if_not_exists(updateLog, :empty), :log)',
            ExpressionAttributeValues: {
              ':now': now,
              ':log': [
                {
                  userId: input.userId,
                  userName: userName ?? 'Unknown',
                  action: 'remove_item',
                  timestamp: now,
                },
              ],
              ':empty': [],
            },
          }),
        );

        return { success: true, message: 'Item removed from template' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

  /** GET TEMPLATE ITEMS **/
  getTemplateItems: permissionedProcedure('template.view')
    .input(z.object({ templateId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `TEMPLATE#${input.templateId}`,
              ':sk': 'ITEM#',
            },
          }),
        );

        const items = result.Items ?? [];

        // Resolve parent names within the template
        const itemsWithParent = await Promise.all(
          items.map(async (item: any) => {
            let parentName: string | null = null;
            if (item.parent) {
              const parentRes = await doc.send(
                new GetCommand({
                  TableName: TABLE_NAME,
                  Key: {
                    PK: `TEMPLATE#${input.templateId}`,
                    SK: `ITEM#${item.parent}`,
                  },
                }),
              );
              parentName = parentRes.Item?.name ?? null;
            }
            const imageLink = await getPresignedUrl(item.imageKey);
            return { ...item, parentName, imageLink };
          }),
        );

        return { success: true, items: itemsWithParent };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),
});

export type TemplatesRouter = typeof templatesRouter;