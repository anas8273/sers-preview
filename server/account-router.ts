import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { AccountAccessError, AccountConflictError, AccountValidationError, acceptSchoolInvitationForUser, createAcademicYearForUser, createSchoolForUser, getAccountOverviewForUser, inviteSchoolMemberForUser, listAcademicYearsForUser, listSchoolMembersForUser, setSchoolMemberForUser } from "./account-db";
const id = z.number().int().positive();
const role = z.enum(["owner", "admin", "reviewer", "member"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
async function run<T>(operation: () => Promise<T>) {
  try { return await operation(); } catch (error) {
    if (error instanceof AccountAccessError) throw new TRPCError({ code: "FORBIDDEN", message: "العملية غير متاحة لهذا الحساب أو المدرسة" });
    if (error instanceof AccountValidationError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    if (error instanceof AccountConflictError) throw new TRPCError({ code: "CONFLICT", message: error.message });
    throw error;
  }
}
export const accountRouter = router({
  overview: protectedProcedure.query(({ ctx }) => run(() => getAccountOverviewForUser(ctx.user.id))),
  createSchool: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(255) })).mutation(({ ctx, input }) => run(() => createSchoolForUser(ctx.user.id, input.name))),
  members: protectedProcedure.input(z.object({ organizationId: id })).query(({ ctx, input }) => run(() => listSchoolMembersForUser(ctx.user.id, input.organizationId))),
  inviteMember: protectedProcedure.input(z.object({ organizationId: id, targetUserId: id, role })).mutation(({ ctx, input }) => run(() => inviteSchoolMemberForUser(ctx.user.id, input))),
  acceptInvitation: protectedProcedure.input(z.object({ organizationId: id })).mutation(({ ctx, input }) => run(() => acceptSchoolInvitationForUser(ctx.user.id, input.organizationId))),
  setMember: protectedProcedure.input(z.object({ organizationId: id, membershipId: id, role, status: z.enum(["active", "suspended", "left"]) })).mutation(({ ctx, input }) => run(() => setSchoolMemberForUser(ctx.user.id, input))),
  academicYears: protectedProcedure.query(({ ctx }) => run(() => listAcademicYearsForUser(ctx.user.id))),
  createAcademicYear: protectedProcedure.input(z.object({ ownerType: z.enum(["personal", "organization"]), organizationId: id.optional(), label: z.string().trim().min(2).max(100), startsOn: date, endsOn: date, terms: z.array(z.object({ label: z.string().trim().min(2).max(100), startsOn: date, endsOn: date })).min(1).max(3) })).mutation(({ ctx, input }) => run(() => createAcademicYearForUser(ctx.user.id, input))),
});
