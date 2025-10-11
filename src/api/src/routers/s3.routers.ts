// src/routers/s3.router.ts
import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import { presignUpload, presignGet, list, deleteObject } from '../services/s3.services';

export const s3Router = router({
  presignUpload: publicProcedure
    .input(
      z.object({
        key: z.string().min(1),
        contentType: z.string().min(1),
        expiresInSec: z.number().int().positive().optional(),
      }),
    )
    .mutation(({ input }) =>
      presignUpload(input.key, input.contentType, input.expiresInSec ?? 900),
    ),

  presignGet: publicProcedure
    .input(
      z.object({ key: z.string().min(1), expiresInSec: z.number().int().positive().optional() }),
    )
    .query(({ input }) => presignGet(input.key, input.expiresInSec ?? 900)),

  list: publicProcedure
    .input(z.object({ prefix: z.string().optional() }).optional())
    .query(({ input }) => list(input?.prefix)),

  delete: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(({ input }) => deleteObject(input.key)),
});
