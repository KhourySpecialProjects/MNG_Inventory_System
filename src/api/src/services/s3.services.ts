import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET!;
if (!BUCKET) console.warn(' S3_BUCKET not set');

const s3 = new S3Client({ region: REGION });

export async function presignUpload(key: string, contentType: string, expiresInSec = 900) {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const url = await getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
  return { url, key, bucket: BUCKET, region: REGION };
}

export async function presignGet(key: string, expiresInSec = 900) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const url = await getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
  return { url, key, bucket: BUCKET, region: REGION };
}

export async function list(prefix?: string) {
  const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  return (out.Contents ?? []).map((o) => ({
    key: o.Key!,
    size: o.Size ?? 0,
    lastModified: o.LastModified,
  }));
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  return { deleted: true, key };
}

// streaming download through backend if we need?
export async function getObjectStream(key: string) {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return { body: out.Body as Readable, contentType: out.ContentType ?? 'application/octet-stream' };
}
