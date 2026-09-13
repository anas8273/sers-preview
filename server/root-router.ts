import { mergeRouters, router } from "./_core/trpc";
import { domainRouter } from "./domain-router";
import { reviewSupportRouter } from "./review-support-router";
import { appRouter as legacyAppRouter } from "./routers";

const domainRootRouter = router({ domain: domainRouter });
const reviewSupportRootRouter = router({ reviewSupport: reviewSupportRouter });

export const appRouter = mergeRouters(legacyAppRouter, domainRootRouter, reviewSupportRootRouter);
export type AppRouter = typeof appRouter;
