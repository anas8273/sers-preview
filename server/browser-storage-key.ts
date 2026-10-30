import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { browserStorageKeys } from "../drizzle/auth";
import { getDb } from "./db";

/** Caller identity must come from protectedProcedure, never a client user ID. */
export async function browserStorageKeyForUser(userId: number) {
  const db = await getDb();
  if (!db || !Number.isSafeInteger(userId) || userId < 1) throw new Error("Private browser storage unavailable");
  await db.insert(browserStorageKeys).values({ userId, keyHex: randomBytes(32).toString("hex") })
    .onDuplicateKeyUpdate({ set: { userId } });
  const [row] = await db.select().from(browserStorageKeys).where(eq(browserStorageKeys.userId, userId));
  if (!row || !/^[a-f0-9]{64}$/.test(row.keyHex)) throw new Error("Private browser storage unavailable");
  return { key: row.keyHex, scope: createHash("sha256").update(`sers-browser-v1:${row.keyHex}`).digest("hex") };
}
