import { mergeRouters, router } from "./_core/trpc";
import { domainRouter } from "./domain-router";
import { publicOutputRouter } from "./public-output-router";
import { reviewSupportRouter } from "./review-support-router";
import { shareOutputRouter } from "./share-output-router";
import { appRouter as legacyAppRouter } from "./routers";
import { accountRouter } from "./account-router";
import { evidenceUploadRouter } from "./evidence-upload-router";
import { notificationRouter } from "./notification-router";
import { workVersionDocxRouter } from "./work-version-docx-router";

const domainRootRouter = router({ domain: domainRouter });
const publicOutputRootRouter = router({ publicOutput: publicOutputRouter });
const reviewSupportRootRouter = router({ reviewSupport: reviewSupportRouter });
const shareOutputRootRouter = router({ shareOutput: shareOutputRouter });

export const appRouter = mergeRouters(
  legacyAppRouter,
  domainRootRouter,
  publicOutputRootRouter,
  reviewSupportRootRouter,
  shareOutputRootRouter,
  router({ account: accountRouter, evidenceUpload: evidenceUploadRouter, notification: notificationRouter, workVersionDocx: workVersionDocxRouter }),
);
export type AppRouter = typeof appRouter;
