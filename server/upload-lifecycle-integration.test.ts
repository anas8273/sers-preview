import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { assets, memberships, notifications, organizations, workAssetLinks, workItems, workVersions } from "../drizzle/domain-core";
import { uploadEvents, uploadIntents, uploadQuotaBudgets } from "../drizzle/upload-intents";
import { getDb } from "./db";
import { beginUploadIntentForUser, cancelUploadIntentForUser, getUploadIntentForUser, provisionUploadBudgetForUser,
  claimUploadReceptionForUser, prepareUploadReception, claimUploadValidationForUser, finishUploadValidation,
  expireUploadIntentsForScope, UploadIntentAccessError, UploadIntentQuotaError } from "./upload-intent-db";
import { receiveUploadIntentForUser } from "./upload-reception-service";
import { cleanupUploadIntent, completeUploadIntentForUser, downloadReadyAssetForUser } from "./upload-lifecycle-service";
import type { PrivateUploadStorage } from "./private-upload-storage";
import type { UploadScanner } from "./upload-scanner";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
const bytes = Buffer.from("Synthetic evidence only — شاهد تجريبي", "utf8");
const digest = createHash("sha256").update(bytes).digest("hex");
async function* source() { yield bytes; }
function dependencies() {
  const objects = new Map<string, { version: string; bytes: Uint8Array; sha256: string }>();
  const retired = new Set<string>();
  const storage: PrivateUploadStorage = {
    capabilities: { privateObjects: true, conditionalCreate: true, versionedDelete: true, permanentKeyRetirement: true },
    putPrivateIfAbsent: vi.fn(async value => {
      if (objects.has(value.key) || retired.has(value.key)) return { status: "exists" as const };
      const version = randomUUID(); objects.set(value.key, { version, bytes: value.bytes.slice(), sha256: value.sha256 });
      return { status: "created" as const, version };
    }),
    headPrivate: vi.fn(async (key, version) => {
      const item = objects.get(key);
      if (!item || (version && version !== item.version)) return { status: "missing" as const };
      return { status: "found" as const, version: item.version, bytes: item.bytes.byteLength, sha256: item.sha256, private: true };
    }),
    readPrivate: vi.fn(async (key, version, maxBytes) => {
      const item = objects.get(key);
      return item && item.version === version && item.bytes.byteLength <= maxBytes
        ? { status: "found" as const, bytes: item.bytes.slice() } : { status: "unknown" as const };
    }),
    deletePrivateIfVersion: vi.fn(async (key, version) => {
      const item = objects.get(key);
      if (item && item.version !== version) return { status: "version_mismatch" as const };
      retired.add(key); objects.delete(key);
      return { status: item ? "deleted" as const : "missing" as const };
    }),
  };
  // Test double only: production always wires the real configured scanner.
  const scanner: UploadScanner = { policyVersion: "integration-v1", scan: vi.fn(async value => ({ status: "clean" as const,
    policyVersion: "integration-v1", sha256: createHash("sha256").update(value.bytes).digest("hex"), bytes: value.bytes.byteLength,
    mimeType: "text/plain", engineVersion: "integration-double-1",
  })) };
  return { storage, scanner, objects, retired };
}

suite("private upload scan, publication, download and cleanup on MySQL", () => {
  let owner = 0, outsider = 0, colleague = 0, school = 0, work = 0;
  const userIds: number[] = [];
  const input = (schoolOwned = false) => ({ idempotencyKey: randomUUID(), fileName: "شاهد.txt", mimeType: "text/plain", expectedBytes: bytes.length,
    ...(schoolOwned ? { ownerType: "organization" as const, organizationId: school, workId: work } : {}),
  });
  async function row(id: string) { const db = (await getDb())!; const [value] = await db.select().from(uploadIntents).where(eq(uploadIntents.id, id)); return value; }
  async function budget(schoolOwned = false) { const db = (await getDb())!; const [value] = await db.select().from(uploadQuotaBudgets).where(eq(uploadQuotaBudgets.scopeKey, schoolOwned ? `organization:${school}` : `personal:${owner}`)); return value; }
  async function readyForScan(deps = dependencies(), schoolOwned = false) {
    const request = input(schoolOwned);
    const intent = await beginUploadIntentForUser(owner, request);
    await receiveUploadIntentForUser(owner, { id: intent.id, expectedRevision: 0, source: source() }, deps.storage);
    return { intent: (await getUploadIntentForUser(owner, intent.id))!, deps, request };
  }
  async function recoveryDue(id: string, cleanup = false) {
    const db = (await getDb())!;
    await db.update(uploadIntents).set(cleanup
      ? { cleanupLeaseUntil: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)`, nextCleanupAt: null }
      : { leaseUntil: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)`, nextValidationAt: null }).where(eq(uploadIntents.id, id));
  }
  async function clearFixtures() {
    if (!userIds.length) return;
    const db = (await getDb())!;
    const intents = await db.select({ id: uploadIntents.id }).from(uploadIntents).where(inArray(uploadIntents.actorUserId, userIds));
    if (intents.length) await db.delete(uploadEvents).where(inArray(uploadEvents.intentId, intents.map(x => x.id)));
    await db.delete(notifications).where(inArray(notifications.userId, userIds));
    await db.delete(workVersions).where(eq(workVersions.workItemId, work));
    await db.delete(workAssetLinks).where(eq(workAssetLinks.workItemId, work));
    await db.delete(uploadIntents).where(inArray(uploadIntents.actorUserId, userIds));
    await db.delete(assets).where(inArray(assets.creatorUserId, userIds));
    await db.delete(uploadQuotaBudgets).where(inArray(uploadQuotaBudgets.scopeKey, [`personal:${owner}`, `organization:${school}`]));
  }
  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("Upload lifecycle tests require disposable CI MySQL");
    const db = (await getDb())!;
    const [result] = await db.execute(sql`SELECT DATABASE() AS name, VERSION() AS version`);
    const database = (result as unknown as Array<{ name: string; version: string }>)[0];
    expect(database.name).toBe("sers_test"); expect(database.version).toMatch(/^8\.4\./);
    for (const role of ["owner", "outsider", "colleague"]) {
      const [created] = await db.insert(users).values({ openId: `upload-lifecycle-${role}-${randomUUID()}` }); userIds.push(Number(created.insertId));
    }
    [owner, outsider, colleague] = userIds;
    const [organization] = await db.insert(organizations).values({ name: `Lifecycle school ${randomUUID()}` }); school = Number(organization.insertId);
    await db.insert(memberships).values([{ organizationId: school, userId: owner, role: "owner", status: "active" }, { organizationId: school, userId: colleague, role: "reviewer", status: "active" }]);
    const [created] = await db.insert(workItems).values({ creatorUserId: owner, ownerType: "organization", ownerOrganizationId: school, type: "report", title: "Synthetic lifecycle work" }); work = Number(created.insertId);
  });
  beforeEach(async () => {
    await clearFixtures();
    const db = (await getDb())!;
    await db.insert(uploadQuotaBudgets).values([{ scopeKey: `personal:${owner}`, limitBytes: 4096, maxActiveIntents: 10 }, { scopeKey: `organization:${school}`, limitBytes: 4096, maxActiveIntents: 10 }]);
    await db.update(memberships).set({ status: "active" }).where(eq(memberships.organizationId, school));
    await db.update(workItems).set({ deletedAt: null }).where(eq(workItems.id, work));
  });
  afterAll(async () => {
    if (!userIds.length) return;
    await clearFixtures();
    const db = (await getDb())!;
    await db.delete(workItems).where(eq(workItems.id, work));
    await db.delete(memberships).where(eq(memberships.organizationId, school));
    await db.delete(organizations).where(eq(organizations.id, school));
    await db.delete(users).where(inArray(users.id, userIds));
  });

  it("publishes one asset, work link, event and notification atomically across repeated completion", async () => {
    const { intent, deps, request } = await readyForScan(dependencies(), true);
    const result = await completeUploadIntentForUser(owner, intent.id, deps);
    expect(result).toMatchObject({ state: "ready", assetId: expect.any(Number) });
    expect(await completeUploadIntentForUser(owner, intent.id, deps)).toEqual(result);
    expect(await beginUploadIntentForUser(owner, request)).toEqual(result);
    expect(deps.scanner.scan).toHaveBeenCalledOnce();
    const db = (await getDb())!;
    expect(await db.select().from(assets).where(eq(assets.id, result!.assetId!))).toHaveLength(1);
    expect(await db.select().from(workAssetLinks).where(eq(workAssetLinks.assetId, result!.assetId!))).toHaveLength(1);
    expect(await db.select().from(uploadEvents).where(eq(uploadEvents.intentId, intent.id))).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.dedupeKey, `upload-ready:${intent.id}`))).toHaveLength(1);
    expect(await budget(true)).toMatchObject({ reservedBytes: 0, retainedBytes: 0, storedBytes: bytes.length, activeIntents: 0 });
    expect(await row(intent.id)).toMatchObject({ sha256: digest, scanPolicyVersion: "integration-v1", scanEngineVersion: "integration-double-1", detectedMimeType: "text/plain" });
  });

  it("uses a single validation lease for concurrent completions", async () => {
    const { intent, deps } = await readyForScan();
    await Promise.all(Array.from({ length: 5 }, () => completeUploadIntentForUser(owner, intent.id, deps)));
    expect((await getUploadIntentForUser(owner, intent.id))?.state).toBe("ready");
    expect(deps.scanner.scan).toHaveBeenCalledOnce();
  });

  it("rolls back Asset, outbox and quota when notification creation fails", async () => {
    const { intent, deps } = await readyForScan();
    const db = (await getDb())!;
    await db.insert(notifications).values({ userId: owner, type: "test-collision", dedupeKey: `upload-ready:${intent.id}`, title: "fixture" });
    await expect(completeUploadIntentForUser(owner, intent.id, deps)).rejects.toThrow();
    expect(await db.select().from(assets).where(eq(assets.creatorUserId, owner))).toHaveLength(0);
    expect(await db.select().from(uploadEvents).where(eq(uploadEvents.intentId, intent.id))).toHaveLength(0);
    expect(await budget()).toMatchObject({ retainedBytes: bytes.length, storedBytes: 0, activeIntents: 1 });
    expect(await row(intent.id)).toMatchObject({ state: "validating", assetId: null });
    await db.delete(notifications).where(eq(notifications.dedupeKey, `upload-ready:${intent.id}`));
    await recoveryDue(intent.id);
    expect((await completeUploadIntentForUser(owner, intent.id, deps))?.state).toBe("ready");
  });

  it("returns the committed asset after a lost publication acknowledgement", async () => {
    const { intent, deps } = await readyForScan();
    const db = (await getDb())!;
    const scan = deps.scanner.scan, transact = db.transaction;
    let intercepted: ReturnType<typeof vi.spyOn> | undefined;
    deps.scanner.scan = vi.fn(async value => {
      const verdict = await scan(value);
      intercepted = vi.spyOn(db, "transaction").mockImplementationOnce(async callback => {
        await transact.call(db, callback); throw new Error("commit acknowledgement lost");
      });
      return verdict;
    });
    try { await expect(completeUploadIntentForUser(owner, intent.id, deps)).rejects.toThrow("commit acknowledgement lost"); }
    finally { intercepted?.mockRestore(); deps.scanner.scan = scan; }
    const committed = await completeUploadIntentForUser(owner, intent.id, deps);
    expect(committed?.state).toBe("ready");
    expect(await db.select().from(assets).where(eq(assets.creatorUserId, owner))).toHaveLength(1);
    expect(deps.storage.deletePrivateIfVersion).not.toHaveBeenCalled();
  });

  it("does not publish on scanner outage, wrong receipt or corrupted stored bytes", async () => {
    const deps = dependencies();
    vi.mocked(deps.scanner.scan).mockResolvedValueOnce({ status: "unknown", policyVersion: "integration-v1", reason: "offline" });
    const { intent } = await readyForScan(deps);
    expect((await completeUploadIntentForUser(owner, intent.id, deps))?.state).toBe("quarantined");
    await recoveryDue(intent.id);
    vi.mocked(deps.scanner.scan).mockResolvedValueOnce({ status: "clean", policyVersion: "integration-v1", sha256: "0".repeat(64), bytes: bytes.length, mimeType: "text/plain", engineVersion: "fake" });
    expect((await completeUploadIntentForUser(owner, intent.id, deps))?.state).toBe("quarantined");
    await recoveryDue(intent.id);
    const stored = await row(intent.id); deps.objects.get(stored.objectKey!)!.bytes = new Uint8Array(bytes.length).fill(1);
    expect((await completeUploadIntentForUser(owner, intent.id, deps))?.state).toBe("rejected");
    expect(await budget()).toMatchObject({ retainedBytes: bytes.length, storedBytes: 0, activeIntents: 1 });
  });

  it("prevents cancellation or membership revocation during scan from publishing", async () => {
    const a = await readyForScan();
    const scan = a.deps.scanner.scan;
    a.deps.scanner.scan = vi.fn(async value => {
      const current = (await getUploadIntentForUser(owner, a.intent.id))!;
      await cancelUploadIntentForUser(owner, a.intent.id, current.revision);
      return scan(value);
    });
    expect((await completeUploadIntentForUser(owner, a.intent.id, a.deps))?.state).toBe("cancelled");
    const b = await readyForScan(dependencies(), true);
    const secondScan = b.deps.scanner.scan;
    b.deps.scanner.scan = vi.fn(async value => {
      const db = (await getDb())!;
      await db.update(memberships).set({ status: "suspended" }).where(and(eq(memberships.organizationId, school), eq(memberships.userId, owner)));
      return secondScan(value);
    });
    expect(await completeUploadIntentForUser(owner, b.intent.id, b.deps)).toBeUndefined();
    expect(await row(b.intent.id)).toMatchObject({ state: "validating", assetId: null });
  });

  it("fences stale scan verdicts after lease takeover", async () => {
    const { intent, deps } = await readyForScan();
    const old = (await claimUploadValidationForUser(owner, intent.id, "integration-v1"))!;
    await recoveryDue(intent.id);
    expect((await completeUploadIntentForUser(owner, intent.id, deps))?.state).toBe("ready");
    expect((await finishUploadValidation(old, { status: "rejected", policyVersion: old.policyVersion, reason: "late" }))?.state).toBe("ready");
    expect(await budget()).toMatchObject({ retainedBytes: 0, storedBytes: bytes.length, activeIntents: 0 });
  });

  it("expires an intent during scanning without publishing or releasing its object", async () => {
    const { intent, deps } = await readyForScan();
    const scan = deps.scanner.scan;
    deps.scanner.scan = vi.fn(async value => {
      const db = (await getDb())!;
      await db.update(uploadIntents).set({ expiresAt: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)` }).where(eq(uploadIntents.id, intent.id));
      return scan(value);
    });
    expect((await completeUploadIntentForUser(owner, intent.id, deps))?.state).toBe("expired");
    expect(await row(intent.id)).toMatchObject({ assetId: null, storageChargeHeld: true });
    expect(await budget()).toMatchObject({ retainedBytes: bytes.length, storedBytes: 0, activeIntents: 1 });
    expect(deps.storage.deletePrivateIfVersion).not.toHaveBeenCalled();
  });

  it("authorizes download independently of links and rechecks school revocation after storage read", async () => {
    const { intent, deps } = await readyForScan(dependencies(), true);
    expect(await downloadReadyAssetForUser(owner, 99999999, deps.storage)).toBeUndefined();
    const result = (await completeUploadIntentForUser(owner, intent.id, deps))!;
    expect(await downloadReadyAssetForUser(outsider, result.assetId!, deps.storage)).toBeUndefined();
    const db = (await getDb())!;
    await db.delete(workAssetLinks).where(eq(workAssetLinks.assetId, result.assetId!));
    await db.update(workItems).set({ deletedAt: new Date() }).where(eq(workItems.id, work));
    expect((await downloadReadyAssetForUser(colleague, result.assetId!, deps.storage))?.bytes).toEqual(bytes);
    const read = deps.storage.readPrivate;
    deps.storage.readPrivate = vi.fn(async (...args) => {
      const value = await read(...args);
      await db.update(memberships).set({ status: "suspended" }).where(and(eq(memberships.organizationId, school), eq(memberships.userId, colleague)));
      return value;
    });
    expect(await downloadReadyAssetForUser(colleague, result.assetId!, deps.storage)).toBeUndefined();
  });

  it("cleans rejected quarantine conditionally and releases capacity once", async () => {
    const deps = dependencies();
    vi.mocked(deps.scanner.scan).mockResolvedValue({ status: "rejected", policyVersion: "integration-v1", reason: "malware" });
    const { intent } = await readyForScan(deps);
    expect((await completeUploadIntentForUser(owner, intent.id, deps))?.state).toBe("rejected");
    const outcomes = await Promise.all([cleanupUploadIntent(intent.id, deps.storage), cleanupUploadIntent(intent.id, deps.storage)]);
    expect(outcomes.some(x => x.completed)).toBe(true);
    expect(await cleanupUploadIntent(intent.id, deps.storage)).toEqual({ completed: true });
    expect(deps.objects.size).toBe(0);
    expect(await budget()).toMatchObject({ retainedBytes: 0, storedBytes: 0, activeIntents: 0 });
    expect(await row(intent.id)).toMatchObject({ state: "rejected", cleanupState: "complete", storageChargeHeld: false });
  });

  it("recovers deletion after lost acknowledgement without double release", async () => {
    const { intent, deps } = await readyForScan();
    await cancelUploadIntentForUser(owner, intent.id, intent.revision);
    const remove = deps.storage.deletePrivateIfVersion;
    deps.storage.deletePrivateIfVersion = vi.fn(async (...args) => { await remove(...args); return { status: "unknown" }; });
    expect(await cleanupUploadIntent(intent.id, deps.storage)).toEqual({ completed: false });
    expect(await budget()).toMatchObject({ retainedBytes: bytes.length, activeIntents: 1 });
    deps.storage.deletePrivateIfVersion = remove;
    await recoveryDue(intent.id, true);
    expect(await cleanupUploadIntent(intent.id, deps.storage)).toEqual({ completed: true });
    expect(await budget()).toMatchObject({ retainedBytes: 0, activeIntents: 0 });
  });

  it("keeps an unknown missing write charged, then tombstones its late completion", async () => {
    const deps = dependencies();
    const first = await beginUploadIntentForUser(owner, input());
    const lease = (await claimUploadReceptionForUser(owner, first.id, 0))!;
    await prepareUploadReception(lease, bytes.length, digest);
    await cancelUploadIntentForUser(owner, first.id, 1);
    expect(await cleanupUploadIntent(first.id, deps.storage)).toEqual({ completed: false });
    expect(await budget()).toMatchObject({ retainedBytes: bytes.length });
    await deps.storage.putPrivateIfAbsent({ key: lease.key, bytes, sha256: digest });
    await recoveryDue(first.id, true);
    expect(await cleanupUploadIntent(first.id, deps.storage)).toEqual({ completed: true });
    expect(await deps.storage.putPrivateIfAbsent({ key: lease.key, bytes, sha256: digest })).toEqual({ status: "exists" });
    expect(deps.objects.size).toBe(0);
  });

  it("retires a matching durable preparation after an interrupted partial write", async () => {
    const deps = dependencies();
    const first = await beginUploadIntentForUser(owner, input());
    const lease = (await claimUploadReceptionForUser(owner, first.id, 0))!;
    await prepareUploadReception(lease, bytes.length, digest);
    await cancelUploadIntentForUser(owner, first.id, 1);
    deps.storage.headPrivate = vi.fn(async () => ({ status: "unknown" }));
    deps.storage.inspectPrivatePreparation = vi.fn(async () => ({ status: "prepared", version: "durable-preparation", bytes: bytes.length, sha256: digest }));
    expect(await cleanupUploadIntent(first.id, deps.storage)).toEqual({ completed: true });
    expect(deps.storage.deletePrivateIfVersion).toHaveBeenCalledWith(lease.key, "durable-preparation");
    expect(await row(first.id)).toMatchObject({ cleanupObjectVersion: "durable-preparation", cleanupState: "complete", storageChargeHeld: false });
    expect(await budget()).toMatchObject({ retainedBytes: 0, activeIntents: 0 });
    expect(await deps.storage.putPrivateIfAbsent({ key: lease.key, bytes, sha256: digest })).toEqual({ status: "exists" });
    expect(deps.scanner.scan).not.toHaveBeenCalled();
  });

  it("keeps mismatched preparation identity charged and never trusts it as scanned bytes", async () => {
    const deps = dependencies();
    const first = await beginUploadIntentForUser(owner, input());
    const lease = (await claimUploadReceptionForUser(owner, first.id, 0))!;
    await prepareUploadReception(lease, bytes.length, digest);
    await cancelUploadIntentForUser(owner, first.id, 1);
    deps.storage.inspectPrivatePreparation = vi.fn(async () => ({ status: "prepared", version: "other-preparation", bytes: bytes.length, sha256: "0".repeat(64) }));
    expect(await cleanupUploadIntent(first.id, deps.storage)).toEqual({ completed: false });
    expect(deps.storage.deletePrivateIfVersion).not.toHaveBeenCalled();
    expect(await budget()).toMatchObject({ retainedBytes: bytes.length, activeIntents: 1 });
    expect(await row(first.id)).toMatchObject({ cleanupObjectVersion: null, storageChargeHeld: true });
    const pending = await readyForScan(dependencies());
    pending.deps.storage.headPrivate = vi.fn(async () => ({ status: "missing" }));
    pending.deps.storage.inspectPrivatePreparation = vi.fn(async () => ({ status: "prepared", version: "planned-only", bytes: bytes.length, sha256: digest }));
    expect((await completeUploadIntentForUser(owner, pending.intent.id, pending.deps))?.state).toBe("quarantined");
    expect(pending.deps.storage.inspectPrivatePreparation).not.toHaveBeenCalled();
    expect(pending.deps.scanner.scan).not.toHaveBeenCalled();
  });

  it("does not delete ready assets, legal holds, live references or mismatched versions", async () => {
    const ready = await readyForScan();
    await completeUploadIntentForUser(owner, ready.intent.id, ready.deps);
    expect(await cleanupUploadIntent(ready.intent.id, ready.deps.storage)).toEqual({ completed: false });
    expect(ready.deps.storage.deletePrivateIfVersion).not.toHaveBeenCalled();
    const held = await readyForScan();
    await cancelUploadIntentForUser(owner, held.intent.id, held.intent.revision);
    const db = (await getDb())!;
    await db.update(uploadIntents).set({ legalHold: true }).where(eq(uploadIntents.id, held.intent.id));
    expect(await cleanupUploadIntent(held.intent.id, held.deps.storage)).toEqual({ completed: false });
    expect(held.deps.storage.deletePrivateIfVersion).not.toHaveBeenCalled();
    const referenced = await readyForScan();
    await cancelUploadIntentForUser(owner, referenced.intent.id, referenced.intent.revision);
    const stored = await row(referenced.intent.id);
    await db.insert(workVersions).values({ workItemId: work, versionNumber: 1, createdByUserId: owner, snapshot: { storageKey: stored.objectKey } });
    expect(await cleanupUploadIntent(referenced.intent.id, referenced.deps.storage)).toEqual({ completed: false });
    expect(referenced.deps.storage.deletePrivateIfVersion).not.toHaveBeenCalled();
    const mismatch = await readyForScan();
    await cancelUploadIntentForUser(owner, mismatch.intent.id, mismatch.intent.revision);
    const mismatchRow = await row(mismatch.intent.id);
    mismatch.deps.objects.get(mismatchRow.objectKey!)!.version = "different-version";
    expect(await cleanupUploadIntent(mismatch.intent.id, mismatch.deps.storage)).toEqual({ completed: false });
    expect(mismatch.deps.objects.size).toBe(1);
  });

  it("does not free prepared objects on a provider without permanent key retirement", async () => {
    const { intent, deps } = await readyForScan();
    await cancelUploadIntentForUser(owner, intent.id, intent.revision);
    deps.storage.capabilities.permanentKeyRetirement = false;
    expect(await cleanupUploadIntent(intent.id, deps.storage)).toEqual({ completed: false });
    expect(deps.storage.deletePrivateIfVersion).not.toHaveBeenCalled();
    expect(await budget()).toMatchObject({ retainedBytes: bytes.length });
  });

  it("cleans pre-storage cancellation after revocation and does not treat ready expiry as deletion", async () => {
    const deps = dependencies();
    const first = await beginUploadIntentForUser(owner, input(true));
    await claimUploadReceptionForUser(owner, first.id, 0);
    await cancelUploadIntentForUser(owner, first.id, 1);
    const db = (await getDb())!;
    await db.update(memberships).set({ status: "suspended" }).where(and(eq(memberships.organizationId, school), eq(memberships.userId, owner)));
    expect(await cleanupUploadIntent(first.id, deps.storage)).toEqual({ completed: true });
    expect(await budget(true)).toMatchObject({ retainedBytes: 0, activeIntents: 0 });
    const ready = await readyForScan();
    const result = (await completeUploadIntentForUser(owner, ready.intent.id, ready.deps))!;
    await db.update(uploadIntents).set({ expiresAt: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)` }).where(eq(uploadIntents.id, ready.intent.id));
    expect(await expireUploadIntentsForScope(`personal:${owner}`)).toEqual({ expired: 0 });
    expect((await downloadReadyAssetForUser(owner, result.assetId!, ready.deps.storage))?.bytes).toEqual(bytes);
  });

  it("provisions trusted policy once, never resets usage and enforces stored capacity", async () => {
    const db = (await getDb())!;
    await db.delete(uploadQuotaBudgets).where(eq(uploadQuotaBudgets.scopeKey, `personal:${owner}`));
    const request = input();
    expect(await provisionUploadBudgetForUser(owner, request, { limitBytes: bytes.length, maxActiveIntents: 2 })).toEqual({ provisioned: true });
    const deps = dependencies();
    const first = await beginUploadIntentForUser(owner, request);
    await receiveUploadIntentForUser(owner, { id: first.id, expectedRevision: 0, source: source() }, deps.storage);
    await completeUploadIntentForUser(owner, first.id, deps);
    expect(await provisionUploadBudgetForUser(owner, request, { limitBytes: 9999, maxActiveIntents: 99 })).toEqual({ provisioned: false });
    expect(await budget()).toMatchObject({ limitBytes: bytes.length, storedBytes: bytes.length, activeIntents: 0 });
    await expect(beginUploadIntentForUser(owner, input())).rejects.toBeInstanceOf(UploadIntentQuotaError);
    await expect(provisionUploadBudgetForUser(outsider, input(true), { limitBytes: 1, maxActiveIntents: 1 })).rejects.toBeInstanceOf(UploadIntentAccessError);
  });
});
