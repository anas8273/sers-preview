import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import {
  assets,
  contentBlocks,
  memberships,
  organizations,
  outputs,
  reviewComments,
  reviews,
  workAssetLinks,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import {
  createAssetForUser,
  createWorkItemForUser,
  linkAssetToWorkForUser,
} from "./domain-db";
import { getDb } from "./db";
import { hashProtectedOutputPassword } from "./output-password";
import {
  PublicOutputNotFoundError,
  PublicOutputPasswordInvalidError,
  PublicOutputPasswordRequiredError,
  resolvePublicOutput,
} from "./public-output-service";
import {
  createOutputForUser,
  createReviewForUser,
  decideReviewForUser,
  revokeOutputForUser,
} from "./review-output-db";
import {
  createReportDraftVersionForUser,
  saveReportDraftForUser,
} from "./work-report-draft-db";

const integrationEnabled = process.env.SERS_INTEGRATION === "1";
const suite = integrationEnabled ? describe : describe.skip;

suite("public and protected WorkVersion outputs against real MySQL", () => {
  let ownerId = 0;
  let reviewerId = 0;
  let organizationId = 0;
  let sequence = 0;

  async function clean() {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.delete(reviewComments);
    await db.delete(reviews);
    await db.delete(outputs);
    await db.delete(workAssetLinks);
    await db.delete(workVersions);
    await db.delete(contentBlocks);
    await db.delete(assets);
    await db.delete(workItems);
    await db.delete(memberships);
    await db.delete(organizations);
    await db.delete(users);
  }

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await clean();
    const owner = await db.insert(users).values({ openId: "public-output-owner", name: "Output Owner" });
    const reviewer = await db.insert(users).values({ openId: "public-output-reviewer", name: "Output Reviewer" });
    ownerId = Number(owner[0].insertId);
    reviewerId = Number(reviewer[0].insertId);
    const organization = await db.insert(organizations).values({ name: "Public Output School" });
    organizationId = Number(organization[0].insertId);
    await db.insert(memberships).values([
      { organizationId, userId: ownerId, role: "owner", status: "active" },
      { organizationId, userId: reviewerId, role: "reviewer", status: "active" },
    ]);
  });

  afterAll(async () => {
    if (integrationEnabled) await clean();
  });

  function token(prefix: string) {
    sequence += 1;
    return `${prefix}-${sequence.toString().padStart(3, "0")}-abcdefghijklmnopqrstuvwxyz`;
  }

  async function createReportVersion(approved: boolean) {
    const work = await createWorkItemForUser(ownerId, {
      title: `تقرير مشاركة ${sequence + 1}`,
      type: "report",
      ownerType: "organization",
      organizationId,
    });
    const selected = await createAssetForUser(ownerId, {
      title: "شاهد مختار",
      kind: "link",
      externalUrl: "https://private-source.example/selected",
      ownerType: "organization",
      organizationId,
    });
    const unselected = await createAssetForUser(ownerId, {
      title: "شاهد غير مختار",
      kind: "link",
      externalUrl: "https://private-source.example/unselected",
      ownerType: "organization",
      organizationId,
    });
    await linkAssetToWorkForUser(ownerId, { workItemId: work!.id, assetId: selected!.id, caption: "دليل التنفيذ المراجع" });
    await linkAssetToWorkForUser(ownerId, { workItemId: work!.id, assetId: unselected!.id });

    const draft = await saveReportDraftForUser(ownerId, {
      workItemId: work!.id,
      expectedRevision: 0,
      templateId: "program-report",
      themeId: "formal",
      fontFamily: "Cairo",
      fields: {
        summary: "ملخص عام يمكن مشاركته",
        results: "نتيجة معتمدة",
      },
      evidenceAssetIds: [selected!.id],
    });
    const version = await createReportDraftVersionForUser(ownerId, {
      workItemId: work!.id,
      expectedRevision: draft.revision,
      reason: approved ? "نسخة معتمدة للمشاركة" : "نسخة غير معتمدة",
    });

    if (approved) {
      const review = await createReviewForUser(ownerId, version.id, reviewerId);
      await decideReviewForUser(reviewerId, review!.id, "approved", "Approved for controlled sharing");
    }
    return { work: work!, version, selected: selected!, unselected: unselected! };
  }

  it("delivers only safe report fields and selected evidence from an approved public link", async () => {
    const { version, selected, unselected } = await createReportVersion(true);
    const publicToken = token("public-link");
    const output = await createOutputForUser(ownerId, {
      workVersionId: version.id,
      type: "link",
      visibility: "public",
      token: publicToken,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(output).toBeTruthy();

    const resolved = await resolvePublicOutput(publicToken);
    expect(resolved.visibility).toBe("public");
    expect(resolved.versionNumber).toBe(version.versionNumber);
    expect(resolved.report.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "summary", value: "ملخص عام يمكن مشاركته" }),
      expect.objectContaining({ key: "results", value: "نتيجة معتمدة" }),
    ]));
    expect(resolved.report.evidence).toEqual([
      expect.objectContaining({ title: "شاهد مختار", caption: "دليل التنفيذ المراجع" }),
    ]);

    const serialized = JSON.stringify(resolved);
    expect(serialized).not.toContain(String(selected.id));
    expect(serialized).not.toContain(String(unselected.id));
    expect(serialized).not.toContain("private-source.example");
    expect(serialized).not.toContain("ownerUserId");
    expect(serialized).not.toContain("ownerOrganizationId");
    expect(serialized).not.toContain("storageKey");
  });

  it("supports QR records through the same approved public delivery contract", async () => {
    const { version } = await createReportVersion(true);
    const qrToken = token("public-qr");
    await createOutputForUser(ownerId, {
      workVersionId: version.id,
      type: "qr",
      visibility: "public",
      token: qrToken,
    });
    const resolved = await resolvePublicOutput(qrToken);
    expect(resolved.type).toBe("qr");
    expect(resolved.report.title).toContain("تقرير مشاركة");
  });

  it("requires and verifies the password for protected outputs", async () => {
    const { version } = await createReportVersion(true);
    const protectedToken = token("protected-link");
    await createOutputForUser(ownerId, {
      workVersionId: version.id,
      type: "link",
      visibility: "protected",
      token: protectedToken,
      passwordHash: hashProtectedOutputPassword("Strong-pass-1"),
    });

    await expect(resolvePublicOutput(protectedToken)).rejects.toBeInstanceOf(PublicOutputPasswordRequiredError);
    await expect(resolvePublicOutput(protectedToken, "wrong-password")).rejects.toBeInstanceOf(PublicOutputPasswordInvalidError);
    const resolved = await resolvePublicOutput(protectedToken, "Strong-pass-1");
    expect(resolved.visibility).toBe("protected");
  });

  it("does not expose private, expired, revoked, unapproved, or deleted-work outputs", async () => {
    const approved = await createReportVersion(true);
    const privateToken = token("private-link");
    await createOutputForUser(ownerId, {
      workVersionId: approved.version.id,
      type: "link",
      visibility: "private",
      token: privateToken,
    });
    await expect(resolvePublicOutput(privateToken)).rejects.toBeInstanceOf(PublicOutputNotFoundError);

    const expiredToken = token("expired-link");
    const expired = await createOutputForUser(ownerId, {
      workVersionId: approved.version.id,
      type: "link",
      visibility: "public",
      token: expiredToken,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const db = await getDb();
    await db!.update(outputs).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(outputs.id, expired!.id));
    await expect(resolvePublicOutput(expiredToken)).rejects.toBeInstanceOf(PublicOutputNotFoundError);

    const revokedToken = token("revoked-link");
    const revoked = await createOutputForUser(ownerId, {
      workVersionId: approved.version.id,
      type: "link",
      visibility: "public",
      token: revokedToken,
    });
    expect(await revokeOutputForUser(ownerId, revoked!.id)).toBe(true);
    await expect(resolvePublicOutput(revokedToken)).rejects.toBeInstanceOf(PublicOutputNotFoundError);

    const unapproved = await createReportVersion(false);
    const unapprovedToken = token("unapproved-link");
    await db!.insert(outputs).values({
      workVersionId: unapproved.version.id,
      createdByUserId: ownerId,
      type: "link",
      visibility: "public",
      token: unapprovedToken,
    });
    await expect(resolvePublicOutput(unapprovedToken)).rejects.toBeInstanceOf(PublicOutputNotFoundError);

    const deleted = await createReportVersion(true);
    const deletedToken = token("deleted-work-link");
    await createOutputForUser(ownerId, {
      workVersionId: deleted.version.id,
      type: "link",
      visibility: "public",
      token: deletedToken,
    });
    await db!.update(workItems).set({ deletedAt: new Date() }).where(eq(workItems.id, deleted.work.id));
    await expect(resolvePublicOutput(deletedToken)).rejects.toBeInstanceOf(PublicOutputNotFoundError);
  });
});
