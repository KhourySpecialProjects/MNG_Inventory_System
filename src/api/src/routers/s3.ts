// S3 router – uploads profile images and fetches inventory PDFs
import { z } from 'zod';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { router, protectedProcedure, permissionedProcedure } from './trpc';
import { loadConfig } from '../process';

const config = loadConfig();
const REGION = config.REGION;
const BUCKET_NAME = config.BUCKET_NAME;
const KMS_KEY_ARN = config.KMS_KEY_ARN;

const s3 = new S3Client({ region: REGION });

if (!BUCKET_NAME) throw new Error('Missing S3_BUCKET_NAME');
if (!KMS_KEY_ARN) console.warn('[S3] Warning: KMS encryption disabled');

function parseDataUrl(dataUrl: string) {
  // Parse base64 data URL into { mime, buffer }
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error('Invalid data URL format');
  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { mime, buffer };
}

export const s3Router = router({
  uploadProfileImage: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(3),
        dataUrl: z.string().startsWith('data:'),
      }),
    )
    .mutation(async ({ input }) => {
      const { mime, buffer } = parseDataUrl(input.dataUrl);
      const ext = mime.split('/')[1] || 'jpg';
      const key = `Profile/${input.userId}.${ext}`;

      console.log(`[S3] Upload profile image start user=${input.userId} key=${key}`);

      const putParams: PutObjectCommandInput = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mime,
        ...(KMS_KEY_ARN
          ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: KMS_KEY_ARN }
          : {}),
      };

      await s3.send(new PutObjectCommand(putParams));
      console.log(`[S3] Uploaded ${key} size=${buffer.byteLength}`);

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
        { expiresIn: 3600 },
      );

      console.log(`[S3] Generated signed URL for ${key}`);

      return { key, url };
    }),

  getProfileImage: protectedProcedure
    .input(z.object({ userId: z.string().min(3) }))
    .query(async ({ input }) => {
      console.log(`[S3] Fetch profile image user=${input.userId}`);

      const prefix = `Profile/${input.userId}`;
      const exts = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
      let foundUrl: string | null = null;

      for (const ext of exts) {
        const key = `${prefix}.${ext}`;

        try {
          await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
          console.log(`[S3] Found profile image: ${key}`);

          foundUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
            { expiresIn: 3600 },
          );
          break;
        } catch {
          continue;
        }
      }

      if (!foundUrl) console.log(`[S3] No profile image for user=${input.userId}`);

      return foundUrl ? { url: foundUrl } : { url: null };
    }),

  getInventoryForm: permissionedProcedure('reports.create')
    .input(
      z.object({
        teamId: z.string().optional(),
        nsn: z.string().min(1, 'NSN is required'),
      }),
    )
    .query(async ({ input }) => {
      console.log(
        `[S3] getInventoryForm teamId=${input.teamId ?? 'defaultTeam'} nsn=${input.nsn}`,
      );

      const teamId = input.teamId ?? 'defaultTeam';
      const key = `Documents/${teamId}/inventoryForm/${input.nsn}.pdf`;

      try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        console.log(`[S3] Inventory form exists: ${key}`);
      } catch {
        console.log(`[S3] Missing inventory form for nsn=${input.nsn}`);
        throw new Error(`Inventory form for NSN ${input.nsn} not found`);
      }

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
        { expiresIn: 600 },
      );

      console.log(`[S3] Signed URL generated for form ${key}`);

      return { url, key };
    }),
});

export type S3Router = typeof s3Router;
