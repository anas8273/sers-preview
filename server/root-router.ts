import { mergeRouters, router } from "./_core/trpc";
import { domainRouter } from "./domain-router";
import { appRouter as legacyAppRouter } from "./routers";

const domainRootRouter = router({ domain: domainRouter });

export const appRouter = mergeRouters(legacyAppRouter, domainRootRouter);
export type AppRouter = typeof appRouter;
