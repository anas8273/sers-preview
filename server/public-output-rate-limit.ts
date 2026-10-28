import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };

/** Process-local protection. Shared storage is still needed across server replicas. */
export function createPublicOutputRateLimiter(options: {
  now?: () => number;
  windowMs?: number;
  maxIpAttempts?: number;
  maxTokenAttempts?: number;
  maxBuckets?: number;
} = {}) {
  const now = options.now ?? Date.now;
  const windowMs = options.windowMs ?? 5 * 60_000;
  const maxIpAttempts = options.maxIpAttempts ?? 120;
  const maxTokenAttempts = options.maxTokenAttempts ?? 30;
  const maxBuckets = options.maxBuckets ?? 10_000;
  for (const value of [windowMs, maxIpAttempts, maxTokenAttempts, maxBuckets]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid rate limit configuration");
  }
  const ipBuckets = new Map<string, Bucket>();
  const tokenBuckets = new Map<string, Bucket>();

  function consume(buckets: Map<string, Bucket>, key: string, limit: number, timestamp: number) {
    // Insertion order follows fixed-window expiry. Never scan/copy the entire map.
    let removed = 0;
    const entries = buckets.entries();
    while (removed < 32) {
      const entry = entries.next();
      if (entry.done) break;
      const [oldKey, bucket] = entry.value;
      if (bucket.resetAt > timestamp) break;
      buckets.delete(oldKey);
      removed += 1;
    }
    let bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= timestamp) {
      buckets.delete(key);
      bucket = undefined;
    }
    if (!bucket) {
      // Fail closed instead of evicting live counters and resetting attackers' budgets.
      if (buckets.size >= maxBuckets) return false;
      bucket = { count: 0, resetAt: timestamp + windowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  }

  return {
    allow(ip: string | undefined, token: string) {
      const timestamp = now();
      const identity = ip || "unknown";
      // Charge all attempts to the IP first, including rotating/invalid tokens.
      if (!consume(ipBuckets, identity, maxIpAttempts, timestamp)) return false;
      const tokenDigest = createHash("sha256").update(token, "utf8").digest("hex");
      return consume(tokenBuckets, `${identity}:${tokenDigest}`, maxTokenAttempts, timestamp);
    },
    get bucketCounts() {
      return { ip: ipBuckets.size, token: tokenBuckets.size };
    },
  };
}
