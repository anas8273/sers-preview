import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { PortfolioValidationError } from "../shared/portfolio-projection";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createPortfolioDraftVersionForUser,
  getPortfolioDraftForUser,
  PortfolioAccessError,
  PortfolioConflictError,
  savePortfolioDraftForUser,
} from "./portfolio-draft-db";

const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });
const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });
const conflict = (message: string) => new TRPCError({ code: "CONFLICT", message });
const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

const portfolioEntrySchema = z.object({
  id: z.string().trim().min(1).max(64),
  sectionTitle: z.string().trim().min(1).max(128),
  kind: z.enum(["work", "asset"]),
  refId: z.number().int().positive(),
  note: z.string().trim().max(1_000).optional(),
}).strict();

export const portfolioDraftRouter = router({
  get: protectedProcedure
    .input(z.object({ workItemId: z.number().int().positive() }).strict())
    .query(async ({ ctx, input }) => {
      try {
        const result = await getPortfolioDraftForUser(ctx.user.id, input.workItemId);
        if (!result) throw notFound("ملف الإنجاز غير موجود أو لا تملك صلاحية الوصول إليه");
        return result;
      } catch (error) {
        if (error instanceof PortfolioAccessError) throw forbidden(error.message);
        if (error instanceof PortfolioValidationError) throw badRequest(error.message);
        throw error;
      }
    }),

  save: protectedProcedure
    .input(z.object({
      workItemId: z.number().int().positive(),
      expectedRevision: z.number().int().min(0),
      introduction: z.string().max(5_000).default(""),
      entries: z.array(portfolioEntrySchema).max(100).default([]),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      try {
        return await savePortfolioDraftForUser(ctx.user.id, input);
      } catch (error) {
        if (error instanceof PortfolioAccessError) throw forbidden(error.message);
        if (error instanceof PortfolioConflictError) throw conflict(error.message);
        if (error instanceof PortfolioValidationError) throw badRequest(error.message);
        throw error;
      }
    }),

  createVersion: protectedProcedure
    .input(z.object({
      workItemId: z.number().int().positive(),
      expectedRevision: z.number().int().min(1),
      reason: z.string().trim().max(255).optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      try {
        return await createPortfolioDraftVersionForUser(ctx.user.id, input);
      } catch (error) {
        if (error instanceof PortfolioAccessError) throw forbidden(error.message);
        if (error instanceof PortfolioConflictError) throw conflict(error.message);
        if (error instanceof PortfolioValidationError) throw badRequest(error.message);
        throw error;
      }
    }),
});

export type PortfolioDraftRouter = typeof portfolioDraftRouter;
