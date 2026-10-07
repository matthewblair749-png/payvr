import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { checkLimit, clearLimit, rateLimit, recordHit, RateLimitError, __resetRateLimits } = await import("@/server/rate-limit");
const { clientIpFrom } = await import("@/server/request-meta");

describe("rate limiter", () => {
  const policy = { limit: 3, windowMs: 60_000 };

  it("blocks after the limit and says when to retry", () => {
    __resetRateLimits();
    for (let i = 0; i < 3; i++) rateLimit("k", policy);
    expect(() => rateLimit("k", policy)).toThrow(RateLimitError);
  });

  it("only counts what's recorded, and clears", () => {
    __resetRateLimits();
    for (let i = 0; i < 10; i++) checkLimit("login", policy);
    for (let i = 0; i < 3; i++) recordHit("login", policy);
    expect(() => checkLimit("login", policy)).toThrow(RateLimitError);
    clearLimit("login");
    expect(() => checkLimit("login", policy)).not.toThrow();
  });
});

describe("client IP", () => {
  const h = (xff?: string, real?: string) => new Headers({ ...(xff ? { "x-forwarded-for": xff } : {}), ...(real ? { "x-real-ip": real } : {}) });

  it("ignores client-supplied entries to the left of the trusted proxies", () => {
    expect(clientIpFrom(h("6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIpFrom(h("6.6.6.6, 203.0.113.9, 10.0.0.2"), "2")).toBe("203.0.113.9");
    expect(clientIpFrom(h("203.0.113.9"))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then a shared key", () => {
    expect(clientIpFrom(h(undefined, "198.51.100.4"))).toBe("198.51.100.4");
    expect(clientIpFrom(h())).toBe("local");
    expect(clientIpFrom(h("203.0.113.9"), "5")).toBe("203.0.113.9");
  });
});
