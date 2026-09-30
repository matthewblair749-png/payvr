import "server-only";
import { UserError } from "./errors";

/**
 * Sliding-window rate limiter.
 *
 * In-memory: correct for a single Node process (local dev, one container).
 * For multi-instance deploys swap the store for Redis/Upstash; the call sites
 * don't change.
 */
const buckets = new Map<string, number[]>();

export class RateLimitError extends UserError {
  constructor(public retryAfterSeconds: number) {
    super(`Too many requests. Try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitError";
  }
}

/** Throws RateLimitError if `key` exceeded `limit` hits within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    throw new RateLimitError(Math.ceil((windowMs - (now - hits[0])) / 1000));
  }
  hits.push(now);
  buckets.set(key, hits);
  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
  }
}

/** Common policies, in one place so they're easy to audit. */
export const LIMITS = {
  saveDraft: { limit: 120, windowMs: 60_000 },
  mutate: { limit: 60, windowMs: 60_000 },
  brandImport: { limit: 10, windowMs: 60 * 60_000 },
  magicLink: { limit: 5, windowMs: 15 * 60_000 },
} as const;
