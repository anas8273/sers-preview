import { describe, expect, it } from "vitest";
import { createPublicOutputRateLimiter } from "./public-output-rate-limit";

describe("public output rate limits", () => {
  it("blocks the 31st attempt for one link but gives another visitor a separate budget", () => {
    const limiter = createPublicOutputRateLimiter();
    for (let attempt = 0; attempt < 30; attempt += 1) expect(limiter.allow("visitor-a", "link")).toBe(true);
    expect(limiter.allow("visitor-a", "link")).toBe(false);
    expect(limiter.allow("visitor-b", "link")).toBe(true);
  });

  it("caps one IP even when every request rotates the token", () => {
    const limiter = createPublicOutputRateLimiter();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      expect(limiter.allow("visitor-a", `random-token-${attempt}`)).toBe(true);
    }
    expect(limiter.allow("visitor-a", "another-random-token")).toBe(false);
    expect(limiter.bucketCounts).toEqual({ ip: 1, token: 120 });
  });

  it("charges repeated token rejections to the aggregate IP budget", () => {
    const limiter = createPublicOutputRateLimiter({ maxTokenAttempts: 1, maxIpAttempts: 3 });
    expect(limiter.allow("visitor", "one")).toBe(true);
    expect(limiter.allow("visitor", "one")).toBe(false);
    expect(limiter.allow("visitor", "one")).toBe(false);
    expect(limiter.allow("visitor", "two")).toBe(false);
  });

  it("bounds both maps and does not evict live budgets when capacity is exhausted", () => {
    const limiter = createPublicOutputRateLimiter({ maxBuckets: 2, maxTokenAttempts: 1 });
    expect(limiter.allow("visitor-a", "one")).toBe(true);
    expect(limiter.allow("visitor-a", "two")).toBe(true);
    expect(limiter.allow("visitor-a", "three")).toBe(false);
    expect(limiter.allow("visitor-b", "one")).toBe(false);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      expect(limiter.allow(`new-visitor-${attempt}`, "one")).toBe(false);
    }
    expect(limiter.bucketCounts).toEqual({ ip: 2, token: 2 });
    expect(limiter.allow("visitor-a", "one")).toBe(false);
  });

  it("recovers capacity after expiry without extending windows on rejected attempts", () => {
    let timestamp = 0;
    const limiter = createPublicOutputRateLimiter({
      now: () => timestamp, windowMs: 100, maxBuckets: 1, maxIpAttempts: 1,
    });
    expect(limiter.allow("visitor-a", "one")).toBe(true);
    timestamp = 99;
    expect(limiter.allow("visitor-a", "one")).toBe(false);
    expect(limiter.allow("visitor-b", "two")).toBe(false);
    timestamp = 100;
    expect(limiter.allow("visitor-b", "two")).toBe(true);
    expect(limiter.bucketCounts).toEqual({ ip: 1, token: 1 });
  });

  it("gives missing IPs a shared budget instead of allowing untracked requests", () => {
    const limiter = createPublicOutputRateLimiter({ maxIpAttempts: 1 });
    expect(limiter.allow(undefined, "one")).toBe(true);
    expect(limiter.allow(undefined, "two")).toBe(false);
  });

  it("reclaims only a bounded batch of expired entries per request", () => {
    let timestamp = 0;
    const limiter = createPublicOutputRateLimiter({ now: () => timestamp, windowMs: 100, maxBuckets: 100 });
    for (let visitor = 0; visitor < 100; visitor += 1) limiter.allow(`visitor-${visitor}`, "one");
    timestamp = 100;
    expect(limiter.allow("new-visitor", "two")).toBe(true);
    expect(limiter.bucketCounts).toEqual({ ip: 69, token: 69 });
  });
});
