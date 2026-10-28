import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { notifications } from "../drizzle/domain-core";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

export const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    return db.select({ id: notifications.id, type: notifications.type, title: notifications.title, body: notifications.body,
      targetType: notifications.targetType, targetId: notifications.targetId, readAt: notifications.readAt, createdAt: notifications.createdAt })
      .from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(100);
  }),
  markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(notifications).set({ readAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));
    return { success: true };
  }),
});
