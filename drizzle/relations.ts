import { relations } from "drizzle-orm";
import { users, portfolios, uploadedFiles, shareLinks, pdfTemplates, userThemes, activityLogs, sectionConfigs } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  portfolios: many(portfolios),
  uploadedFiles: many(uploadedFiles),
  shareLinks: many(shareLinks),
  themes: many(userThemes),
  createdTemplates: many(pdfTemplates),
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
  user: one(users, { fields: [portfolios.userId], references: [users.id] }),
  reviewer: one(users, { fields: [portfolios.reviewedBy], references: [users.id] }),
  files: many(uploadedFiles),
  shareLinks: many(shareLinks),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  user: one(users, { fields: [uploadedFiles.userId], references: [users.id] }),
  portfolio: one(portfolios, { fields: [uploadedFiles.portfolioId], references: [portfolios.id] }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  portfolio: one(portfolios, { fields: [shareLinks.portfolioId], references: [portfolios.id] }),
  user: one(users, { fields: [shareLinks.userId], references: [users.id] }),
}));

export const pdfTemplatesRelations = relations(pdfTemplates, ({ one }) => ({
  creator: one(users, { fields: [pdfTemplates.createdBy], references: [users.id] }),
}));

export const userThemesRelations = relations(userThemes, ({ one }) => ({
  user: one(users, { fields: [userThemes.userId], references: [users.id] }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
}));

