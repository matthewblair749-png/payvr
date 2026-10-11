/**
 * Sliding-window rate limiter keyed by a caller id (IP for anonymous demo use).
 * In-memory and per instance: enough to stop a single visitor from draining
 * the translation budget. Phase 2 enforces real per-plan limits in Postgres.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit. Returns how long to wait (ms) if over the limit, else 0. */
  check(id: string): number {
    const now = this.now();
    const recent = (this.hits.get(id) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(id, recent);
      return this.windowMs - (now - recent[0]);
    }
    recent.push(now);
    this.hits.set(id, recent);
    // Keep the map from growing forever on a busy instance.
    if (this.hits.size > 10_000) this.prune(now);
    return 0;
  }

  private prune(now: number) {
    for (const [id, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(id);
    }
  }
}
