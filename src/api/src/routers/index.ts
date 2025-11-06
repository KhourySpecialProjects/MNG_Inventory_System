import { router, publicProcedure, mergeRouters } from "./trpc";

// Import all feature routers
import { helloRouter } from "./hello";
import { s3Router } from "./s3";
import { authRouter } from "./auth";
import { teamspaceRouter } from "./teamspace";
import { rolesRouter } from "./roles";
import { itemsRouter } from "./items";
import { homeRouter } from "./home";

// Core/health router
const coreRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
});

// Merge all routers into a single flattened app router
export const appRouter = mergeRouters(
  coreRouter,
  helloRouter,
  s3Router,
  authRouter,
  teamspaceRouter,
  rolesRouter,
  itemsRouter,
  homeRouter
);

// Export type for client
export type AppRouter = typeof appRouter;
