import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { notifications } from "../drizzle/domain-core";
import { users, type User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { notificationRouter } from "./notification-router";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;

suite("notification router isolation on disposable MySQL", () => {
  const userIds: number[] = [];
  let recipient: User;
  let otherRecipient: User;
  let ownNotificationId = 0;
  let otherNotificationId = 0;
  const caller = (user: User | null) => notificationRouter.createCaller({
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });

  async function clearNotifications() {
    if (userIds.length) await (await getDb())!.delete(notifications).where(inArray(notifications.userId, userIds));
  }

  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") {
      throw new Error("Notification integration requires disposable CI MySQL");
    }
    const db = (await getDb())!;
    const [identity] = await db.execute(sql`SELECT DATABASE() AS dbName, VERSION() AS dbVersion`);
    expect((identity as unknown as { dbName: string; dbVersion: string }[])[0]).toMatchObject({ dbName: "sers_test", dbVersion: expect.stringMatching(/^8\.4\./) });
    for (const role of ["user", "admin"] as const) {
      const [inserted] = await db.insert(users).values({ openId: `notification-${randomUUID()}`, role });
      userIds.push(Number(inserted.insertId));
    }
    [recipient] = await db.select().from(users).where(eq(users.id, userIds[0]));
    [otherRecipient] = await db.select().from(users).where(eq(users.id, userIds[1]));
  });

  beforeEach(async () => {
    await clearNotifications();
    const db = (await getDb())!;
    // A matching dedupe key belongs to each recipient independently.
    const [own] = await db.insert(notifications).values({ userId: recipient.id, type: "upload_ready", dedupeKey: "notification-isolation", title: "شاهد جاهز", body: "إشعار صاحب الحساب", targetType: "asset", targetId: "101" });
    const [other] = await db.insert(notifications).values({ userId: otherRecipient.id, type: "review_requested", dedupeKey: "notification-isolation", title: "طلب مراجعة خاص بحساب آخر", targetType: "review", targetId: "202" });
    ownNotificationId = Number(own.insertId);
    otherNotificationId = Number(other.insertId);
  });

  afterAll(async () => {
    await clearNotifications();
    if (userIds.length) await (await getDb())!.delete(users).where(inArray(users.id, userIds));
  });

  it("requires authentication to list or mark notifications", async () => {
    await expect(caller(null).list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).markRead({ id: ownNotificationId })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const [unchanged] = await (await getDb())!.select().from(notifications).where(eq(notifications.id, ownNotificationId));
    expect(unchanged.readAt).toBeNull();
  });

  it("lists only the signed-in recipient's safe fields, including for a platform admin", async () => {
    const own = await caller(recipient).list();
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ id: ownNotificationId, title: "شاهد جاهز", targetType: "asset", targetId: "101", readAt: null });
    expect(own[0]).not.toHaveProperty("userId");
    expect(own[0]).not.toHaveProperty("dedupeKey");
    expect((await caller(otherRecipient).list()).map(notification => notification.id)).toEqual([otherNotificationId]);
  });

  it("cannot mark another recipient's notification read by guessing its ID", async () => {
    expect(await caller(recipient).markRead({ id: otherNotificationId })).toEqual({ success: true });
    expect(await caller(otherRecipient).markRead({ id: ownNotificationId })).toEqual({ success: true });
    const rows = await (await getDb())!.select().from(notifications).where(inArray(notifications.id, [ownNotificationId, otherNotificationId]));
    expect(rows).toHaveLength(2);
    expect(rows.every(notification => notification.readAt === null)).toBe(true);
  });

  it("marks an owned notification and preserves its first read timestamp on retries", async () => {
    const ownCaller = caller(recipient);
    await ownCaller.markRead({ id: ownNotificationId });
    expect((await ownCaller.list())[0].readAt).toBeInstanceOf(Date);
    // A fixed old value exposes an accidental timestamp overwrite without sleeps.
    const firstRead = new Date("2026-01-01T12:00:00.000Z");
    const db = (await getDb())!;
    await db.update(notifications).set({ readAt: firstRead }).where(eq(notifications.id, ownNotificationId));
    await ownCaller.markRead({ id: ownNotificationId });
    const [persisted] = await db.select().from(notifications).where(eq(notifications.id, ownNotificationId));
    expect(persisted.readAt).toEqual(firstRead);
    const [other] = await db.select().from(notifications).where(eq(notifications.id, otherNotificationId));
    expect(other.readAt).toBeNull();
  });
});
