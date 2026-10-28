import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { academicTerms, academicYears, assets, contentBlocks, memberships, organizations, workAssetLinks, workItems, workVersions } from "../drizzle/domain-core";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { AccountAccessError, AccountConflictError, acceptSchoolInvitationForUser, createAcademicYearForUser, createSchoolForUser, getAccountOverviewForUser, inviteSchoolMemberForUser, listAcademicYearsForUser, listSchoolMembersForUser, setSchoolMemberForUser } from "./account-db";
import { assertAssetAccess, assertWorkAccess, createAssetForUser, createWorkItemForUser, createWorkVersionForUser, listAssetsForUser, listWorkItemsForUser } from "./domain-db";
import { createReportDraftVersionForUser, getReportDraftForUser, ReportDraftAccessError, ReportDraftConflictError, saveReportDraftForUser } from "./work-report-draft-db";
const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("account membership and academic contexts on disposable MySQL", () => {
  let owner = 0, colleague = 0, outsider = 0, school = 0, otherSchool = 0;
  const userIds: number[] = [], schoolIds: number[] = [], yearIds: number[] = [];
  const yearInput = (label = "1448–1449") => ({ ownerType: "personal" as const, label, startsOn: "2026-08-01", endsOn: "2027-07-31", terms: [{ label: "الفصل الأول", startsOn: "2026-08-01", endsOn: "2026-12-31" }, { label: "الفصل الثاني", startsOn: "2027-01-01", endsOn: "2027-07-31" }] });
  async function clean() {
    if (!userIds.length) return;
    const db = (await getDb())!;
    const works = await db.select({ id: workItems.id }).from(workItems).where(inArray(workItems.creatorUserId, userIds));
    if (works.length) {
      const ids = works.map(w => w.id);
      await db.delete(workAssetLinks).where(inArray(workAssetLinks.workItemId, ids));
      await db.delete(contentBlocks).where(inArray(contentBlocks.workItemId, ids));
      await db.delete(workVersions).where(inArray(workVersions.workItemId, ids));
      await db.delete(workItems).where(inArray(workItems.id, ids));
    }
    await db.delete(assets).where(inArray(assets.creatorUserId, userIds));
    if (yearIds.length) { await db.delete(academicTerms).where(inArray(academicTerms.academicYearId, yearIds)); await db.delete(academicYears).where(inArray(academicYears.id, yearIds)); yearIds.length = 0; }
    if (schoolIds.length) { await db.delete(memberships).where(inArray(memberships.organizationId, schoolIds)); await db.delete(organizations).where(inArray(organizations.id, schoolIds)); schoolIds.length = 0; }
  }
  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("Account integration requires disposable CI MySQL");
    const db = (await getDb())!;
    const [result] = await db.execute(sql`SELECT DATABASE() AS dbName, VERSION() AS dbVersion`);
    expect((result as any)[0].dbName).toBe("sers_test"); expect((result as any)[0].dbVersion).toMatch(/^8\.4\./);
    for (let i = 0; i < 3; i++) { const [row] = await db.insert(users).values({ openId: `account-${randomUUID()}` }); userIds.push(Number(row.insertId)); }
    [owner, colleague, outsider] = userIds;
  });
  beforeEach(async () => { await clean(); school = (await createSchoolForUser(owner, "مدرسة الاختبار")).id; otherSchool = (await createSchoolForUser(outsider, "المدرسة الأخرى")).id; schoolIds.push(school, otherSchool); });
  afterAll(async () => { await clean(); if (userIds.length) await (await getDb())!.delete(users).where(inArray(users.id, userIds)); });
  async function invited(role: "owner" | "admin" | "reviewer" | "member" = "member") { return inviteSchoolMemberForUser(owner, { organizationId: school, targetUserId: colleague, role }); }
  async function accepted(role: "owner" | "admin" | "reviewer" | "member" = "member") { const invite = await invited(role); await acceptSchoolInvitationForUser(colleague, school); return invite; }
  async function academic(forSchool = false, name?: string) { const year = await createAcademicYearForUser(owner, { ...yearInput(name), ownerType: forSchool ? "organization" : "personal", organizationId: forSchool ? school : undefined }); yearIds.push(year.id); const all = await listAcademicYearsForUser(owner); return all.find(y => y.id === year.id)!; }

  it("creates a school with one active owner and requires the invited account to accept", async () => {
    const invitation = await invited("reviewer");
    expect((await getAccountOverviewForUser(colleague)).schools).toContainEqual(expect.objectContaining({ id: school, status: "invited" }));
    const work = await createWorkItemForUser(owner, { title: "تقرير المدرسة", type: "report", ownerType: "organization", organizationId: school });
    expect(await assertWorkAccess(colleague, work!.id)).toBeUndefined();
    await expect(acceptSchoolInvitationForUser(outsider, school)).rejects.toBeInstanceOf(AccountAccessError);
    await expect(setSchoolMemberForUser(owner, { organizationId: school, membershipId: invitation.id, role: "reviewer", status: "active" })).rejects.toBeInstanceOf(AccountConflictError);
    await acceptSchoolInvitationForUser(colleague, school);
    expect(await assertWorkAccess(colleague, work!.id, "read")).toBeTruthy();
    expect(await assertWorkAccess(colleague, work!.id, "write")).toBeUndefined();
  });

  it("cannot bypass user acceptance through suspension, cancellation and reactivation", async () => {
    const invitation = await invited();
    await setSchoolMemberForUser(owner, { organizationId: school, membershipId: invitation.id, role: "member", status: "suspended" });
    await expect(setSchoolMemberForUser(owner, { organizationId: school, membershipId: invitation.id, role: "member", status: "active" })).rejects.toBeInstanceOf(AccountConflictError);
    await setSchoolMemberForUser(owner, { organizationId: school, membershipId: invitation.id, role: "member", status: "left" });
    await expect(setSchoolMemberForUser(owner, { organizationId: school, membershipId: invitation.id, role: "member", status: "active" })).rejects.toBeInstanceOf(AccountConflictError);
    await expect(acceptSchoolInvitationForUser(colleague, school)).rejects.toBeInstanceOf(AccountAccessError);
    expect(await invited()).toMatchObject({ id: invitation.id, status: "invited" });
    await acceptSchoolInvitationForUser(colleague, school);
    expect((await getAccountOverviewForUser(colleague)).schools[0].status).toBe("active");
  });

  it("protects the last owner including two concurrent attempts to remove owners", async () => {
    const originalOwner = (await listSchoolMembersForUser(owner, school)).find(m => m.userId === owner)!;
    for (const patch of [{ role: "member" as const, status: "active" as const }, { role: "owner" as const, status: "suspended" as const }, { role: "owner" as const, status: "left" as const }]) await expect(setSchoolMemberForUser(owner, { organizationId: school, membershipId: originalOwner.id, ...patch })).rejects.toBeInstanceOf(AccountConflictError);
    const second = await accepted("owner");
    const results = await Promise.allSettled([
      setSchoolMemberForUser(owner, { organizationId: school, membershipId: second.id, role: "member", status: "active" }),
      setSchoolMemberForUser(colleague, { organizationId: school, membershipId: originalOwner.id, role: "member", status: "active" }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rows = await (await getDb())!.select().from(memberships).where(and(eq(memberships.organizationId, school), eq(memberships.role, "owner"), eq(memberships.status, "active")));
    expect(rows).toHaveLength(1);
  });

  it("prevents administrators from promoting themselves or altering owners", async () => {
    const admin = await accepted("admin");
    const members = await listSchoolMembersForUser(owner, school);
    await expect(setSchoolMemberForUser(colleague, { organizationId: school, membershipId: admin.id, role: "owner", status: "active" })).rejects.toBeInstanceOf(AccountAccessError);
    await expect(setSchoolMemberForUser(colleague, { organizationId: school, membershipId: members.find(m => m.userId === owner)!.id, role: "owner", status: "left" })).rejects.toBeInstanceOf(AccountAccessError);
    await expect(inviteSchoolMemberForUser(colleague, { organizationId: school, targetUserId: outsider, role: "admin" })).rejects.toBeInstanceOf(AccountAccessError);
    await expect(listSchoolMembersForUser(outsider, school)).rejects.toBeInstanceOf(AccountAccessError);
  });

  it("removes a suspended creator's school works and assets from list/read/write immediately", async () => {
    const member = await accepted();
    const work = await createWorkItemForUser(colleague, { title: "عمل عضو", type: "report", ownerType: "organization", organizationId: school });
    const asset = await createAssetForUser(colleague, { title: "شاهد عضو", kind: "file", storageKey: "secret/quarantine", metadata: { sha256: "secret" }, ownerType: "organization", organizationId: school });
    const listed = (await listAssetsForUser(colleague)).find(a => a.id === asset!.id)!;
    expect(listed).not.toHaveProperty("storageKey"); expect(listed.metadata).toBeNull();
    await setSchoolMemberForUser(owner, { organizationId: school, membershipId: member.id, role: "member", status: "suspended" });
    expect(await listWorkItemsForUser(colleague)).toEqual([]); expect(await listAssetsForUser(colleague)).toEqual([]);
    expect(await assertWorkAccess(colleague, work!.id)).toBeUndefined(); expect(await assertAssetAccess(colleague, asset!.id)).toBeUndefined();
    expect(await getReportDraftForUser(colleague, work!.id)).toBeUndefined();
    await expect(saveReportDraftForUser(colleague, { workItemId: work!.id, expectedRevision: 0, templateId: "custom", themeId: "classic", fontFamily: "Cairo", fields: { summary: "رفض" }, evidenceAssetIds: [] })).rejects.toBeInstanceOf(ReportDraftAccessError);
  });

  it("denies archived school memberships, works, assets, years and new writes", async () => {
    const year = await academic(true);
    const work = await createWorkItemForUser(owner, { title: "تقرير مؤرشف", type: "report", ownerType: "organization", organizationId: school, academicYearId: year.id, academicTermId: year.terms[0].id });
    const asset = await createAssetForUser(owner, { title: "شاهد", kind: "text", ownerType: "organization", organizationId: school });
    await (await getDb())!.update(organizations).set({ status: "archived" }).where(eq(organizations.id, school));
    expect(await assertWorkAccess(owner, work!.id)).toBeUndefined(); expect(await assertAssetAccess(owner, asset!.id)).toBeUndefined();
    expect(await listWorkItemsForUser(owner)).toEqual([]); expect(await listAssetsForUser(owner)).toEqual([]); expect(await listAcademicYearsForUser(owner)).toEqual([]);
    await expect(listSchoolMembersForUser(owner, school)).rejects.toBeInstanceOf(AccountAccessError);
    await expect(createWorkItemForUser(owner, { title: "ممنوع", type: "report", ownerType: "organization", organizationId: school })).rejects.toThrow("access denied");
  });

  it("reads the current report revision after two writers establish older repeatable-read snapshots", async () => {
    const db = (await getDb())!;
    const [isolationRows] = await db.execute(sql`SELECT @@transaction_isolation AS isolationLevel`);
    expect((isolationRows as unknown as { isolationLevel: string }[])[0].isolationLevel).toBe("REPEATABLE-READ");
    const work = (await createWorkItemForUser(owner, { title: "مسودة متزامنة", type: "report", ownerType: "organization", organizationId: school }))!;
    const base = { workItemId: work.id, expectedRevision: 0, templateId: "custom", themeId: "classic", fontFamily: "Cairo", evidenceAssetIds: [] as number[] };
    const saved = await saveReportDraftForUser(owner, { ...base, fields: { summary: "Initial" } });
    type Result = PromiseSettledResult<Awaited<ReturnType<typeof saveReportDraftForUser>>>;
    let pending: Promise<Result[]> | undefined;
    let results: Result[] = [];
    try {
      await db.transaction(async tx => {
        await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, school)).for("update");
        pending = Promise.allSettled([
          saveReportDraftForUser(owner, { ...base, expectedRevision: saved.revision, fields: { summary: "Writer A" } }),
          saveReportDraftForUser(owner, { ...base, expectedRevision: saved.revision, fields: { summary: "Writer B" } }),
        ]);
        // Both writers have performed the nonlocking ownership hint read and
        // now wait on this scope lock. Release only after observing both in InnoDB.
        let waiting = false;
        for (let attempt = 0; attempt < 200; attempt++) {
          const [raw] = await db.execute(sql`SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) AS count FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID WHERE l.OBJECT_SCHEMA = 'sers_test' AND l.OBJECT_NAME = 'organizations'`);
          if (Number((raw as unknown as { count: number }[])[0].count) >= 2) { waiting = true; break; }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
      });
    } finally {
      if (pending) results = await pending;
    }
    const succeeded = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof saveReportDraftForUser>>> => result.status === "fulfilled");
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(succeeded).toHaveLength(1); expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ReportDraftConflictError);
    const current = (await getReportDraftForUser(owner, work.id))!;
    expect(current.draft.revision).toBe(saved.revision + 1);
    expect(current.draft.fields.summary).toBe(succeeded[0].value.fields.summary);
  });

  it("isolates years by ownership and verifies a term belongs to the chosen year", async () => {
    const personal = await academic(false), schoolYear = await academic(true), next = await academic(false, "1449–1450");
    await expect(createWorkItemForUser(owner, { title: "خطأ نطاق", type: "report", academicYearId: schoolYear.id })).rejects.toBeInstanceOf(AccountAccessError);
    await expect(createWorkItemForUser(owner, { title: "خطأ فصل", type: "report", academicYearId: personal.id, academicTermId: next.terms[0].id })).rejects.toBeInstanceOf(AccountAccessError);
    await expect(createWorkItemForUser(outsider, { title: "خطأ ملكية", type: "report", academicYearId: personal.id })).rejects.toBeInstanceOf(AccountAccessError);
    expect(await listAcademicYearsForUser(outsider)).toEqual([]);
    await expect(createAcademicYearForUser(owner, yearInput())).rejects.toBeInstanceOf(AccountConflictError);
  });

  it("separates work filters and freezes the year/term labels into both version paths", async () => {
    const year = await academic(), next = await academic(false, "1449–1450");
    const first = await createWorkItemForUser(owner, { title: "العام الأول", type: "report", academicYearId: year.id, academicTermId: year.terms[0].id });
    const second = await createWorkItemForUser(owner, { title: "العام الثاني", type: "report", academicYearId: next.id, academicTermId: next.terms[0].id });
    const old = await createWorkItemForUser(owner, { title: "عمل سابق", type: "report" });
    expect((await listWorkItemsForUser(owner, { academicYearId: year.id })).map(w => w.id)).toEqual([first!.id]);
    expect((await listWorkItemsForUser(owner, { academicTermId: next.terms[0].id })).map(w => w.id)).toEqual([second!.id]);
    expect((await listWorkItemsForUser(owner, { unassigned: true })).map(w => w.id)).toEqual([old!.id]);
    const draft = await saveReportDraftForUser(owner, { workItemId: first!.id, expectedRevision: 0, templateId: "custom", themeId: "classic", fontFamily: "Cairo", fields: { summary: "ملخص" }, evidenceAssetIds: [] });
    const reportVersion = await createReportDraftVersionForUser(owner, { workItemId: first!.id, expectedRevision: draft.revision });
    const genericVersion = await createWorkVersionForUser(owner, first!.id, { kind: "report", academicContext: { yearLabel: "spoofed" } });
    const db = (await getDb())!;
    await db.update(academicYears).set({ label: "renamed by a trusted migration" }).where(eq(academicYears.id, year.id));
    const snapshots = await db.select().from(workVersions).where(inArray(workVersions.id, [reportVersion.id, genericVersion!.id]));
    expect(snapshots).toHaveLength(2);
    for (const version of snapshots) expect(version.snapshot.academicContext).toMatchObject({ yearLabel: year.label, termLabel: year.terms[0].label, yearId: year.id });
  });
});
