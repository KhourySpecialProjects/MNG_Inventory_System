import { runExport } from '../src/routers/export';
import { spawn } from 'child_process';

// ---- Mock process config ----
jest.mock('../src/process', () => ({
  loadConfig: () => ({
    BUCKET_NAME: 'test-bucket',
    REGION: 'us-east-1',
  }),
}));

// ---- Mock FS ----
jest.mock('fs', () => {
  const fileMock = {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn((event: string, cb: Function) => {
      if (event === 'finish') {
        cb();
      }
    }),
  };

  return {
    createWriteStream: jest.fn(() => fileMock),
    chmodSync: jest.fn(),
  };
});

// ---- Mock S3 ----
jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn(async () => {
    // Fake S3 Body stream-ish object
    const body: any = {
      pipe: (dest: any) => {
        dest.write('#!/usr/bin/env python3\nprint("hello")\n');
        dest.end();
        return dest;
      },
      on: jest.fn(), 
    };

    return { Body: body };
  });

  return {
    S3Client: jest.fn(() => ({
      send: sendMock,
    })),
    GetObjectCommand: jest.fn(),
  };
});

// ---- Mock Python spawn ----
jest.mock('child_process', () => {
  const spawnMock = jest.fn((cmd: string, args: string[]) => {
    const scriptPath = args?.[0] ?? '';

    let stdoutData = '';
    if (scriptPath.includes('2404-handler.py')) {
     
      stdoutData = JSON.stringify({
        ok: true,
        s3Key: 's3://test-bucket/Documents/team123/2404/DA2404_team_team123.pdf',
      });
    } else if (scriptPath.includes('inventory-handler.py')) {
     
      stdoutData = 'id,name\n1,Item One\n2,Item Two\n';
    }

    return {
      stdout: {
        on: (event: string, cb: Function) => {
          if (event === 'data') {
            cb(Buffer.from(stdoutData));
          }
        },
      },
      stderr: {
        on: jest.fn(),
      },
      on: (event: string, cb: Function) => {
        if (event === 'close') {
          cb(0); 
        }
      },
    };
  });

  return {
    spawn: spawnMock,
  };
});

describe('runExport()', () => {
  it('returns parsed pdf2404 JSON and inventory CSV', async () => {
    const res = await runExport('team123');

    expect(res.success).toBe(true);

    expect(res.pdf2404).toBeDefined();
    expect(res.pdf2404.ok).toBe(true);
    expect(typeof res.pdf2404.s3Key).toBe('string');

   
    expect(typeof res.csvInventory).toBe('string');
    expect(res.csvInventory).toContain('id,name');
    expect(res.csvInventory).toContain('Item One');

    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('calls python twice per export run', async () => {
    await runExport('xyz');
    expect(spawn).toHaveBeenCalledTimes(4);
  });
});
