import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/features/translation/server/rate-limit";
import { translateRequestSchema } from "@/features/translation/server/schema";

describe("RateLimiter", () => {
  it("allows up to the limit, then asks the caller to wait", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.check("ip")).toBe(0);
    now = 100;
    expect(limiter.check("ip")).toBe(0);
    now = 200;
    expect(limiter.check("ip")).toBe(800);
    expect(limiter.check("other-ip")).toBe(0);
    now = 1001;
    expect(limiter.check("ip")).toBe(0);
  });
});

describe("translateRequestSchema", () => {
  it("accepts a normal request and fills defaults", () => {
    expect(translateRequestSchema.parse({ text: " Hi ", to: "es" })).toEqual({
      text: "Hi",
      from: "auto",
      to: "es",
      formality: "default",
    });
  });

  it("rejects empty, oversized and unknown-language requests", () => {
    expect(translateRequestSchema.safeParse({ text: "   ", to: "es" }).success).toBe(false);
    expect(translateRequestSchema.safeParse({ text: "a".repeat(1001), to: "es" }).success).toBe(false);
    expect(translateRequestSchema.safeParse({ text: "Hi", to: "klingon" }).success).toBe(false);
  });
});
