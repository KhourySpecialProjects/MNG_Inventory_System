// Export router — invokes Python Lambdas and clears old S3 exports
import { z } from 'zod';
import { router, permissionedProcedure } from './trpc';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { loadConfig } from '../process';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { isLocalDev } from '../localDev';

const config = loadConfig();
const REGION = config.REGION;

const lambda = isLocalDev ? null : new LambdaClient({ region: REGION });
const s3 = isLocalDev ? null : new S3Client({ region: REGION });

const UPLOADS_BUCKET = config.BUCKET_NAME;

// Remove all old files under Documents/<teamId>/
async function clearOldExports(teamId: string) {
  console.log(`[Export] Clearing old exports teamId=${teamId}`);

  if (!UPLOADS_BUCKET) throw new Error('UPLOADS_BUCKET env var missing');

  const prefix = `Documents/${teamId}/`;

  const listed = await s3!.send(
    new ListObjectsV2Command({
      Bucket: UPLOADS_BUCKET,
      Prefix: prefix,
    }),
  );

  const count = listed.Contents?.length ?? 0;
  console.log(`[S3] Found ${count} existing export files`);

  if (count === 0) return;

  const toDelete = listed.Contents!.map((obj) => ({ Key: obj.Key! }));

  await s3!.send(
    new DeleteObjectsCommand({
      Bucket: UPLOADS_BUCKET,
      Delete: { Objects: toDelete },
    }),
  );

  console.log(`[S3] Deleted ${toDelete.length} old export objects`);
}

// Invoke Python Lambda with payload { teamId }
async function invokePythonLambda(functionName: string, teamId: string) {
  console.log(`[Lambda] Invoking ${functionName} for teamId=${teamId}`);

  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify({ teamId }),
    });

    const response = await lambda!.send(command);

    if (!response.Payload) throw new Error(`No payload returned from ${functionName}`);

    const payloadString = new TextDecoder().decode(response.Payload);
    const result = JSON.parse(payloadString);

    if (response.FunctionError) {
      console.error(`[Lambda] Error in ${functionName}:`, result);
      throw new Error(result.errorMessage || `Lambda ${functionName} failed with FunctionError`);
    }

    console.log(`[Lambda] Success ${functionName}`);
    return result.statusCode && result.body
      ? typeof result.body === 'string'
        ? JSON.parse(result.body)
        : result.body
      : result;
  } catch (err: any) {
    console.error(`[Lambda] invokePythonLambda error for ${functionName}:`, err);
    throw new Error(`Failed to invoke ${functionName}: ${err.message}`);
  }
}

// Main export: clears exports → invokes inventory + pdf Lambdas
export async function runExport(teamId: string) {
  console.log(`[Export] runExport start teamId=${teamId}`);

  // Local dev mode: return mock response with actual data
  if (isLocalDev) {
    console.log('[LocalDev] Export: returning mock response (Lambda not available)');
    
    // Generate mock CSV content
    const mockCSV = 'Item Name,Status,Quantity,NSN\nM4 Carbine,Completed,1,1005-01-231-0973\nACH Helmet,Damaged,2,8470-01-519-8669\n';
    
    // Generate mock PDF as base64 (minimal valid PDF)
    const mockPDFBase64 = 'JVBERi0xLjQKJeLj0lMAKVN0YXJ0eHJlZiAwCiUlRU9G';
    
    return {
      success: true,
      pdf2404: { 
        ok: true,
        downloadBase64: mockPDFBase64,
        filename: `DA-Form-2404-${teamId}.pdf`
      },
      csvInventory: { 
        ok: true,
        csvContent: mockCSV,
        filename: `Inventory-Report-${teamId}.csv`
      },
    };
  }

  const pdf2404FunctionName = process.env.EXPORT_2404_FUNCTION_NAME;
  const inventoryFunctionName = process.env.EXPORT_INVENTORY_FUNCTION_NAME;

  if (!pdf2404FunctionName || !inventoryFunctionName) {
    console.error('[Export] Missing Lambda env vars');
    throw new Error('Export function names not configured.');
  }

  await clearOldExports(teamId);

  try {
    const [pdf2404Response, csvResponse] = await Promise.all([
      invokePythonLambda(pdf2404FunctionName, teamId),
      invokePythonLambda(inventoryFunctionName, teamId),
    ]);

    const ok1 = pdf2404Response?.ok;
    const ok2 = csvResponse?.ok;

    console.log(`[Export] Lambda statuses pdf2404=${ok1} csvInventory=${ok2}`);

    if (!ok1 && !ok2) {
      throw new Error('Both export operations failed');
    }

    console.log('[Export] runExport success');
    return {
      success: true,
      pdf2404: pdf2404Response,
      csvInventory: csvResponse,
    };
  } catch (err) {
    console.error('❌ runExport error:', err);
    throw err;
  }
}

// TRPC Router
export const exportRouter = router({
  getExport: permissionedProcedure('reports.create')
    .input(z.object({ teamId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      console.log(`[Export] getExport called teamId=${input.teamId}`);

      try {
        const result = await runExport(input.teamId);
        return result;
      } catch (err: any) {
        console.error(`[Export] Failed teamId=${input.teamId}`, err);
        return {
          success: false,
          error: err.message || 'Failed to run export.',
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        };
      }
    }),
});
