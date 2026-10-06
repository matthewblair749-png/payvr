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

/** Throws RateLimitError if `key` exceeded `limit` hits within `windowMs`. */
export function rateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    throw new RateLimitError(Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)));
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  }
}

/** Test hook. */
export function __resetRateLimits() {
  buckets.clear();
}

/** All policies in one place, so they're easy to audit. */
export const LIMITS = {
  login: { limit: 10, windowMs: 15 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 15 * 60_000 },
  mutate: { limit: 60, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 60 * 60_000 },
  ask: { limit: 20, windowMs: 60_000 },
  report: { limit: 10, windowMs: 60 * 60_000 },
} as const;
