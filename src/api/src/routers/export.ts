import { z } from 'zod';
import { router, permissionedProcedure } from './trpc';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { loadConfig } from '../process';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const config = loadConfig();
const REGION = config.REGION;

const lambda = new LambdaClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;

/**
 * Clears ALL previous exports under:
 *    Documents/<teamId>/
 */
async function clearOldExports(teamId: string) {
  if (!UPLOADS_BUCKET) {
    throw new Error("UPLOADS_BUCKET env var missing");
  }

  const prefix = `Documents/${teamId}/`;

  const listed = await s3.send(new ListObjectsV2Command({
    Bucket: UPLOADS_BUCKET,
    Prefix: prefix,
  }));

  if (!listed.Contents || listed.Contents.length === 0) return;

  const toDelete = listed.Contents.map(obj => ({ Key: obj.Key! }));

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: UPLOADS_BUCKET,
      Delete: { Objects: toDelete },
    })
  );
}

/**
 * Invoke a Python Lambda function
 */
async function invokePythonLambda(functionName: string, teamId: string) {
  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({ teamId }),
    });

    const response = await lambda.send(command);

    if (!response.Payload) {
      throw new Error(`No payload returned from ${functionName}`);
    }

    const payloadString = new TextDecoder().decode(response.Payload);
    const result = JSON.parse(payloadString);

    if (response.FunctionError) {
      throw new Error(`Lambda error in ${functionName}: ${result.errorMessage || 'Unknown error'}`);
    }

    if (result.statusCode && result.body) {
      return typeof result.body === 'string'
        ? JSON.parse(result.body)
        : result.body;
    }

    return result;
  } catch (err: any) {
    throw new Error(`Failed to invoke ${functionName}: ${err.message}`);
  }
}

/**
 * Main export function - clears old exports then invokes both Python Lambdas
 */
export async function runExport(teamId: string) {
  const pdf2404FunctionName = process.env.EXPORT_2404_FUNCTION_NAME;
  const inventoryFunctionName = process.env.EXPORT_INVENTORY_FUNCTION_NAME;

  if (!pdf2404FunctionName || !inventoryFunctionName) {
    throw new Error('Export function names not configured. Check CDK deployment.');
  }

  await clearOldExports(teamId);

  try {
    const [pdf2404Response, csvResponse] = await Promise.all([
      invokePythonLambda(pdf2404FunctionName, teamId),
      invokePythonLambda(inventoryFunctionName, teamId),
    ]);

    if (!pdf2404Response?.ok && !csvResponse?.ok) {
      throw new Error('Both export operations failed');
    }

    return {
      success: true,
      pdf2404: pdf2404Response,
      csvInventory: csvResponse,
    };
  } catch (err: any) {
    throw err;
  }
}

// TRPC Router
export const exportRouter = router({
  getExport: permissionedProcedure('reports.create')
    .input(z.object({ teamId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const result = await runExport(input.teamId);
        return result;
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Failed to run export.',
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        };
      }
    }),
});
