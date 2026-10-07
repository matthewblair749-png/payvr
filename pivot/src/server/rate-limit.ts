import "server-only";
import { UserError } from "./errors";

/**
 * Sliding-window rate limiter.
 *
 * In-memory: correct for a single Node process (local dev, one container).
 * For multi-instance deploys swap the store for Redis/Upstash; call sites
 * don't change.
 */
const buckets = new Map<string, number[]>();

export class RateLimitError extends UserError {
  constructor(public retryAfterSeconds: number) {
    super(
      retryAfterSeconds > 90
        ? `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`
        : `Too many attempts. Try again in ${retryAfterSeconds} seconds.`,
    );
    this.name = "RateLimitError";
  }
}

type Policy = { limit: number; windowMs: number };

/** Throws RateLimitError if `key` already has `limit` hits within `windowMs` (records nothing). */
export function checkLimit(key: string, { limit, windowMs }: Policy) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, hits);
  if (hits.length >= limit) throw new RateLimitError(Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)));
}

/** Records one hit for `key`. */
export function recordHit(key: string, { windowMs }: Policy) {
  const now = Date.now();
  const hits = buckets.get(key) ?? [];
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  }
}

/** Takes back the most recent hit for `key` (an attempt that turned out fine). */
export function releaseHit(key: string) {
  buckets.get(key)?.pop();
}

/** Forgets every hit for `key` (e.g. failed logins after a successful one). */
export function clearLimit(key: string) {
  buckets.delete(key);
}

/** Throws RateLimitError if `key` exceeded `limit` hits within `windowMs`, otherwise records a hit. */
export function rateLimit(key: string, policy: Policy) {
  checkLimit(key, policy);
  recordHit(key, policy);
}

/** Test hook. */
export function __resetRateLimits() {
  buckets.clear();
}

/** All policies in one place, so they're easy to audit. */
export const LIMITS = {
  /** Failed logins for one email from one IP. */
  login: { limit: 10, windowMs: 15 * 60_000 },
  /** Failed logins for one email from anywhere: high enough that a stranger can't easily lock a user out. */
  loginAccount: { limit: 100, windowMs: 15 * 60_000 },
  /** Failed logins from one IP, any email. */
  loginIp: { limit: 30, windowMs: 15 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 15 * 60_000 },
  mutate: { limit: 60, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 60 * 60_000 },
  ask: { limit: 20, windowMs: 60_000 },
  report: { limit: 10, windowMs: 60 * 60_000 },
} as const;
