import { router, publicProcedure } from "./trpc";

// Import your feature routers here
import { helloRouter } from "./hello";
import { s3Router } from "./s3";
import { authRouter } from "./auth";
import { teamspaceRouter } from "./teamspace";
import { rolesRouter } from "./roles";
import { itemsRouter } from "./items";

// Combine all routers - use nested structure
export const appRouter = router({
  hello: helloRouter,
  s3: s3Router,
  auth: authRouter,
  teamspace: teamspaceRouter,
  roles: rolesRouter,
  items: itemsRouter,

  // Core health check
  health: publicProcedure.query(() => ({ ok: true })),
});

// Export type for client
export type AppRouter = typeof appRouter;
