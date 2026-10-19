import { mergeRouters, router } from "./_core/trpc";
import { domainRouter } from "./domain-router";
import { publicOutputRouter } from "./public-output-router";
import { reviewSupportRouter } from "./review-support-router";
import { appRouter as legacyAppRouter } from "./routers";

const domainRootRouter = router({ domain: domainRouter });
const publicOutputRootRouter = router({ publicOutput: publicOutputRouter });
const reviewSupportRootRouter = router({ reviewSupport: reviewSupportRouter });

export const appRouter = mergeRouters(
  legacyAppRouter,
  domainRootRouter,
  publicOutputRootRouter,
  reviewSupportRootRouter,
);
export type AppRouter = typeof appRouter;
