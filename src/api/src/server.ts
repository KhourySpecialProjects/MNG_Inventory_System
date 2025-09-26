import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use("/trpc", trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext: () => ({}),
}));

app.get("/", (_req, res) => {
  res.type("text/plain").send("API up. Try GET /trpc/hello");
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

export default app;
