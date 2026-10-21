import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { memberships, organizations, workItems } from "../drizzle/domain-core";
import { uploadIntents, uploadQuotaBudgets } from "../drizzle/upload-intents";
import { getDb } from "./db";
import {
  beginUploadIntentForUser, getUploadIntentForUser, cancelUploadIntentForUser,
  expireUploadIntentsForScope, UploadIntentConflictError,
  UploadIntentAccessError, UploadIntentQuotaError,
} from "./upload-intent-db";

const enabled = process.env.SERS_INTEGRATION === "1";
const suite = enabled ? describe : describe.skip;
suite("upload intent scopes and reservations on real MySQL", () => {
  let owner = 0, outsider = 0, colleague = 0, school = 0, otherSchool = 0;
  let personalWork = 0, schoolWork = 0, otherWork = 0;
  const actorIds: number[] = [], schoolIds: number[] = [], workIds: number[] = [];
  const scopes: string[] = [];
  const input = (key = randomUUID()) => ({ idempotencyKey: key, fileName: "شاهد.pdf", mimeType: "application/pdf", expectedBytes: 128 });
  const schoolInput = () => ({ ...input(), ownerType: "organization" as const, organizationId: school, workId: schoolWork });
  async function budget(scopeKey = `personal:${owner}`) {
    const db = (await getDb())!;
    const [row] = await db.select().from(uploadQuotaBudgets).where(eq(uploadQuotaBudgets.scopeKey, scopeKey));
    return row;
  }
  async function setBudget(values: { limitBytes?: number; maxActiveIntents?: number }, scopeKey = `personal:${owner}`) {
    const db = (await getDb())!;
    await db.update(uploadQuotaBudgets).set(values).where(eq(uploadQuotaBudgets.scopeKey, scopeKey));
  }

  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") {
      throw new Error("Upload intent integration requires the disposable CI database");
    }
    const db = (await getDb())!;
    const [result] = await db.execute(sql`SELECT DATABASE() AS dbName, VERSION() AS dbVersion`);
    const row = (result as unknown as Array<{ dbName: string; dbVersion: string }>)[0];
    expect(row.dbName).toBe("sers_test");
    expect(row.dbVersion).toMatch(/^8\.4\./);
    for (const role of ["owner", "outsider", "colleague"]) {
      const [created] = await db.insert(users).values({ openId: `upload-${role}-${randomUUID()}` });
      actorIds.push(Number(created.insertId));
    }
    [owner, outsider, colleague] = actorIds;
    for (const name of ["school", "other-school"]) {
      const [created] = await db.insert(organizations).values({ name: `upload-${name}-${randomUUID()}` });
      schoolIds.push(Number(created.insertId));
    }
    [school, otherSchool] = schoolIds;
    await db.insert(memberships).values([
      { organizationId: school, userId: owner, role: "owner", status: "active" },
      { organizationId: school, userId: colleague, role: "member", status: "active" },
      { organizationId: otherSchool, userId: outsider, role: "owner", status: "active" },
    ]);
    for (const value of [
      { creatorUserId: owner, ownerType: "personal" as const, ownerUserId: owner },
      { creatorUserId: owner, ownerType: "organization" as const, ownerOrganizationId: school },
      { creatorUserId: outsider, ownerType: "organization" as const, ownerOrganizationId: otherSchool },
    ]) {
      const [created] = await db.insert(workItems).values({ ...value, type: "report", title: "Upload fixture" });
      workIds.push(Number(created.insertId));
    }
    [personalWork, schoolWork, otherWork] = workIds;
    scopes.push(...actorIds.map(id => `personal:${id}`), ...schoolIds.map(id => `organization:${id}`));
  });

  beforeEach(async () => {
    const db = (await getDb())!;
    await db.delete(uploadIntents).where(inArray(uploadIntents.actorUserId, actorIds));
    await db.delete(uploadQuotaBudgets).where(inArray(uploadQuotaBudgets.scopeKey, scopes));
    await db.insert(uploadQuotaBudgets).values(scopes.map(scopeKey => ({ scopeKey, limitBytes: 4096, maxActiveIntents: 10 })));
    await db.update(memberships).set({ status: "active", role: "owner" }).where(and(eq(memberships.organizationId, school), eq(memberships.userId, owner)));
    await db.update(organizations).set({ status: "active" }).where(inArray(organizations.id, schoolIds));
  });

  afterAll(async () => {
    if (!actorIds.length) return;
    const db = (await getDb())!;
    await db.delete(uploadIntents).where(inArray(uploadIntents.actorUserId, actorIds));
    if (scopes.length) await db.delete(uploadQuotaBudgets).where(inArray(uploadQuotaBudgets.scopeKey, scopes));
    if (workIds.length) await db.delete(workItems).where(inArray(workItems.id, workIds));
    if (schoolIds.length) {
      await db.delete(memberships).where(inArray(memberships.organizationId, schoolIds));
      await db.delete(organizations).where(inArray(organizations.id, schoolIds));
    }
    await db.delete(users).where(inArray(users.id, actorIds));
  });

  it("persists one intent and one reservation for concurrent identical retries", async () => {
    const request = input();
    const results = await Promise.all(Array.from({ length: 6 }, () => beginUploadIntentForUser(owner, request)));
    expect(new Set(results.map(x => x.id)).size).toBe(1);
    expect(results.every(x => x.state === "issued" && x.revision === 0)).toBe(true);
    const db = (await getDb())!;
    expect(await db.select().from(uploadIntents).where(eq(uploadIntents.id, results[0].id))).toHaveLength(1);
    expect(await getUploadIntentForUser(owner, results[0].id)).toEqual(results[0]);
    expect(results[0]).not.toHaveProperty("storageKey");
    expect(results[0]).not.toHaveProperty("idempotencyKeyHash");
    expect(await budget()).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
  });

  it("rejects changed semantic fields and rolls back without changing the budget", async () => {
    const request = input();
    const first = await beginUploadIntentForUser(owner, request);
    for (const patch of [{ expectedBytes: 129 }, { fileName: "other.pdf" }, { mimeType: "image/png" }, { workId: personalWork }]) {
      await expect(beginUploadIntentForUser(owner, { ...request, ...patch })).rejects.toBeInstanceOf(UploadIntentConflictError);
    }
    expect(await beginUploadIntentForUser(owner, request)).toEqual(first);
    expect(await budget()).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
  });

  it("isolates users even with the same idempotency key", async () => {
    const request = input();
    const a = await beginUploadIntentForUser(owner, request);
    const b = await beginUploadIntentForUser(outsider, request);
    expect(a.id).not.toBe(b.id);
    expect(await getUploadIntentForUser(outsider, a.id)).toBeUndefined();
    expect(await cancelUploadIntentForUser(outsider, a.id, a.revision)).toBeUndefined();
    expect((await getUploadIntentForUser(owner, a.id))?.state).toBe("issued");
    expect(await budget()).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
  });

  it("allows the same actor key in personal and school scopes with separate reservations", async () => {
    const request = input();
    const personal = await beginUploadIntentForUser(owner, request);
    const schoolRequest = { ...request, ownerType: "organization" as const, organizationId: school, workId: schoolWork };
    const shared = await beginUploadIntentForUser(owner, schoolRequest);
    expect(personal.id).not.toBe(shared.id);
    expect(await beginUploadIntentForUser(owner, request)).toEqual(personal);
    expect(await beginUploadIntentForUser(owner, schoolRequest)).toEqual(shared);
    expect(await budget()).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
    expect(await budget(`organization:${school}`)).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
  });

  it("rejects stale revisions and releases a concurrent cancellation only once", async () => {
    const request = input();
    const first = await beginUploadIntentForUser(owner, request);
    await expect(cancelUploadIntentForUser(owner, first.id, first.revision + 1)).rejects.toBeInstanceOf(UploadIntentConflictError);
    expect(await budget()).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
    const cancelled = await Promise.all(Array.from({ length: 4 }, () => cancelUploadIntentForUser(owner, first.id, first.revision)));
    expect(cancelled.every(x => x?.state === "cancelled" && x.revision === first.revision + 1)).toBe(true);
    expect((await beginUploadIntentForUser(owner, request)).state).toBe("cancelled");
    expect(await budget()).toMatchObject({ reservedBytes: 0, activeIntents: 0 });
  });

  it("rolls back cancellation when an inconsistent budget cannot release the reservation", async () => {
    const first = await beginUploadIntentForUser(owner, input());
    const db = (await getDb())!;
    await db.update(uploadQuotaBudgets).set({ reservedBytes: 0 }).where(eq(uploadQuotaBudgets.scopeKey, `personal:${owner}`));
    await expect(cancelUploadIntentForUser(owner, first.id, first.revision)).rejects.toBeInstanceOf(UploadIntentQuotaError);
    const [persisted] = await db.select().from(uploadIntents).where(eq(uploadIntents.id, first.id));
    expect(persisted).toMatchObject({ state: "issued", revision: 0, reservationHeld: true });
    expect(await budget()).toMatchObject({ reservedBytes: 0, activeIntents: 1 });
  });

  it("expires using database time and never revives or releases twice", async () => {
    const request = input();
    const first = await beginUploadIntentForUser(owner, request);
    const db = (await getDb())!;
    await db.update(uploadIntents).set({ expiresAt: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)` }).where(eq(uploadIntents.id, first.id));
    const expired = await getUploadIntentForUser(owner, first.id);
    expect(expired?.state).toBe("expired");
    expect(expired?.revision).toBe(first.revision + 1);
    expect((await beginUploadIntentForUser(owner, request)).state).toBe("expired");
    expect(await cancelUploadIntentForUser(owner, first.id, first.revision)).toEqual(expired);
    expect(await budget()).toMatchObject({ reservedBytes: 0, activeIntents: 0 });
  });

  it("fails closed without a provisioned policy and creates no intent", async () => {
    const db = (await getDb())!;
    await db.delete(uploadQuotaBudgets).where(eq(uploadQuotaBudgets.scopeKey, `personal:${owner}`));
    await expect(beginUploadIntentForUser(owner, input())).rejects.toBeInstanceOf(UploadIntentQuotaError);
    expect(await db.select().from(uploadIntents).where(eq(uploadIntents.actorUserId, owner))).toHaveLength(0);
  });

  it("serializes distinct requests at the byte limit without leaked rejected reservations", async () => {
    await setBudget({ limitBytes: 256, maxActiveIntents: 10 });
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => beginUploadIntentForUser(owner, input())));
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(2);
    const rejected = results.filter((x): x is PromiseRejectedResult => x.status === "rejected");
    expect(rejected).toHaveLength(4);
    expect(rejected.every(x => x.reason instanceof UploadIntentQuotaError)).toBe(true);
    expect(await budget()).toMatchObject({ reservedBytes: 256, activeIntents: 2 });
    const db = (await getDb())!;
    expect(await db.select().from(uploadIntents).where(eq(uploadIntents.actorUserId, owner))).toHaveLength(2);
  });

  it("enforces the active-intent limit independently of byte capacity", async () => {
    await setBudget({ limitBytes: 4096, maxActiveIntents: 1 });
    const results = await Promise.allSettled([beginUploadIntentForUser(owner, input()), beginUploadIntentForUser(owner, input())]);
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(await budget()).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
  });

  it("shares a school budget across members while isolating another school", async () => {
    const scope = `organization:${school}`;
    await setBudget({ limitBytes: 128 }, scope);
    const results = await Promise.allSettled([
      beginUploadIntentForUser(owner, schoolInput()), beginUploadIntentForUser(colleague, schoolInput()),
    ]);
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((x): x is PromiseRejectedResult => x.status === "rejected")[0].reason).toBeInstanceOf(UploadIntentQuotaError);
    expect(await budget(scope)).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
    await beginUploadIntentForUser(outsider, { ...input(), ownerType: "organization", organizationId: otherSchool, workId: otherWork });
    expect(await budget(`organization:${otherSchool}`)).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
    await expect(beginUploadIntentForUser(outsider, schoolInput())).rejects.toBeInstanceOf(UploadIntentAccessError);
  });

  it("rechecks revoked membership and lets the trusted expiry worker reclaim its reservation", async () => {
    const request = schoolInput();
    const first = await beginUploadIntentForUser(owner, request);
    const db = (await getDb())!;
    await db.update(memberships).set({ status: "suspended" }).where(and(eq(memberships.organizationId, school), eq(memberships.userId, owner)));
    await expect(beginUploadIntentForUser(owner, request)).rejects.toBeInstanceOf(UploadIntentAccessError);
    expect(await getUploadIntentForUser(owner, first.id)).toBeUndefined();
    expect(await cancelUploadIntentForUser(owner, first.id, first.revision)).toBeUndefined();
    expect(await budget(`organization:${school}`)).toMatchObject({ reservedBytes: 128, activeIntents: 1 });
    await db.update(uploadIntents).set({ expiresAt: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)` }).where(eq(uploadIntents.id, first.id));
    const outcomes = await Promise.all([expireUploadIntentsForScope(`organization:${school}`), expireUploadIntentsForScope(`organization:${school}`)]);
    expect(outcomes.reduce((sum, x) => sum + x.expired, 0)).toBe(1);
    expect(await budget(`organization:${school}`)).toMatchObject({ reservedBytes: 0, activeIntents: 0 });
  });

  it("rejects work from a different ownership scope before reserving quota", async () => {
    await expect(beginUploadIntentForUser(owner, { ...schoolInput(), workId: otherWork })).rejects.toBeInstanceOf(UploadIntentAccessError);
    await expect(beginUploadIntentForUser(owner, { ...input(), workId: schoolWork })).rejects.toBeInstanceOf(UploadIntentAccessError);
    expect(await budget()).toMatchObject({ reservedBytes: 0, activeIntents: 0 });
    expect(await budget(`organization:${school}`)).toMatchObject({ reservedBytes: 0, activeIntents: 0 });
  });

  it("rejects archived schools and read-only reviewers", async () => {
    const db = (await getDb())!;
    await db.update(memberships).set({ role: "reviewer" }).where(and(eq(memberships.organizationId, school), eq(memberships.userId, owner)));
    await expect(beginUploadIntentForUser(owner, schoolInput())).rejects.toBeInstanceOf(UploadIntentAccessError);
    await db.update(memberships).set({ role: "owner" }).where(and(eq(memberships.organizationId, school), eq(memberships.userId, owner)));
    await db.update(organizations).set({ status: "archived" }).where(eq(organizations.id, school));
    await expect(beginUploadIntentForUser(owner, schoolInput())).rejects.toBeInstanceOf(UploadIntentAccessError);
    expect(await budget(`organization:${school}`)).toMatchObject({ reservedBytes: 0, activeIntents: 0 });
  });
});
