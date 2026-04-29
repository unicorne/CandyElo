// Two-layer rate limit:
//   1. Per-IP rolling window: 100 votes / 24h
//   2. Per-IP min interval:    800 ms between votes (bot filter)
//
// Backed by Upstash Redis (REST). If the env vars aren't set (e.g. local dev
// without Upstash), we fall back to an in-memory limiter so the dev loop works
// — that fallback is process-local and is NOT suitable for production.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashAvailable = Boolean(url && token);

const redis = upstashAvailable ? new Redis({ url: url!, token: token! }) : null;

const dailyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "24 h"),
      analytics: false,
      prefix: "rl:vote:24h",
    })
  : null;

const intervalLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(1, "800 ms"),
      analytics: false,
      prefix: "rl:vote:interval",
    })
  : null;

// In-memory fallback (dev only)
const memDaily = new Map<string, number[]>();
const memInterval = new Map<string, number>();

function memDailyCheck(key: string) {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const arr = (memDaily.get(key) ?? []).filter((t) => t > cutoff);
  if (arr.length >= 100) {
    return { success: false, remaining: 0 };
  }
  arr.push(now);
  memDaily.set(key, arr);
  return { success: true, remaining: 100 - arr.length };
}

function memIntervalCheck(key: string) {
  const now = Date.now();
  const last = memInterval.get(key) ?? 0;
  if (now - last < 800) {
    return { success: false };
  }
  memInterval.set(key, now);
  return { success: true };
}

export async function checkVoteLimits(ipKey: string) {
  if (intervalLimiter && dailyLimiter) {
    const interval = await intervalLimiter.limit(ipKey);
    if (!interval.success) {
      return { ok: false as const, reason: "too-fast" as const };
    }
    const daily = await dailyLimiter.limit(ipKey);
    if (!daily.success) {
      return { ok: false as const, reason: "daily-cap" as const };
    }
    return { ok: true as const, remaining: daily.remaining };
  }
  // Fallback (dev)
  const interval = memIntervalCheck(ipKey);
  if (!interval.success) return { ok: false as const, reason: "too-fast" as const };
  const daily = memDailyCheck(ipKey);
  if (!daily.success) return { ok: false as const, reason: "daily-cap" as const };
  return { ok: true as const, remaining: daily.remaining };
}
