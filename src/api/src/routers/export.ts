import { z } from 'zod';
import { router, permissionedProcedure } from './trpc';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { loadConfig } from '../process';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const config = loadConfig();
const BUCKET = config.BUCKET_NAME;
const REGION = config.REGION;

const s3 = new S3Client({ region: REGION });

export type PythonResult = {
  stdout: string;
};

// Helpers
export async function downloadScript(key: string, outPath: string): Promise<void> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );

  const bodyStream = res.Body as any;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    bodyStream.pipe(file);
    bodyStream.on('error', reject);
    file.on('finish', resolve);
    file.on('error', reject);
  });
}

export async function runPython(scriptPath: string, teamId: string): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath, teamId]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout });
      else reject(new Error(stderr || `Python exited with ${code}`));
    });
  });
}


// Main Export
export async function runExport(teamId: string) {
  const tmp = '/tmp';

  const paths = {
    p2404: path.join(tmp, '2404-handler.py'),
    pinv: path.join(tmp, 'inventory-handler.py'),
  };

  await downloadScript('scripts/2404-handler.py', paths.p2404);
  await downloadScript('scripts/inventory-handler.py', paths.pinv);

  fs.chmodSync(paths.p2404, 0o755);
  fs.chmodSync(paths.pinv, 0o755);

 const r2404 = await runPython(paths.p2404, teamId);
 const rInv = await runPython(paths.pinv, teamId);

  // 2404 script: stdout is JSON (metadata about PDF location)
  let pdf2404: any;
  try {
    pdf2404 = JSON.parse(r2404.stdout || '{}');
  } catch {
    pdf2404 = {
      ok: false,
      error: 'Invalid JSON from 2404 script',
      raw: r2404.stdout,
    };
  }

  const csvInventory = rInv.stdout || '';

  return {
    success: true,
    pdf2404,
    csvInventory,
  };
}

// TRPC Router
export const exportRouter = router({
  getExport: permissionedProcedure('reports.create')
    .input(z.object({ teamId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await runExport(input.teamId);
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Failed to run export.',
        };
      }
    }),
});
