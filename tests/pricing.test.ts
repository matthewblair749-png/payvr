import { describe, expect, it } from "vitest";
import { DEMO_CONFIG, DEMO_PRODUCT } from "@/lib/checkout/defaults";
import { computeTotals, EMPTY_SELECTIONS } from "@/lib/checkout/pricing";
import type { CheckoutConfig } from "@/lib/checkout/schema";
import { assertTestMode } from "@/server/stripe";

const sel = (p: Partial<typeof EMPTY_SELECTIONS>) => ({ ...EMPTY_SELECTIONS, ...p });

describe("computeTotals", () => {
  it("is just the product price by default", () => {
    const t = computeTotals(DEMO_CONFIG, DEMO_PRODUCT, EMPTY_SELECTIONS);
    expect(t.totalCents).toBe(4800);
    expect(t.lines).toHaveLength(0);
  });

  it("adds upsell, applies the coupon, then tips on the discounted subtotal", () => {
    const t = computeTotals(DEMO_CONFIG, DEMO_PRODUCT, sel({ upsellAdded: true, couponCode: "lumen10", tipPercent: 10 }));
    // 4800 + 1200 = 6000; -10% = 5400; +10% tip = 540
    expect(t.subtotalCents).toBe(6000);
    expect(t.discountCents).toBe(600);
    expect(t.tipCents).toBe(540);
    expect(t.totalCents).toBe(5940);
    expect(t.couponApplied?.code).toBe("LUMEN10");
  });

  it("ignores unknown coupons and coupons on a hidden coupon block", () => {
    expect(computeTotals(DEMO_CONFIG, DEMO_PRODUCT, sel({ couponCode: "FREE100" })).discountCents).toBe(0);
    const hidden: CheckoutConfig = { ...DEMO_CONFIG, blocks: DEMO_CONFIG.blocks.map((b) => (b.type === "coupon" ? { ...b, hidden: true } : b)) };
    expect(computeTotals(hidden, DEMO_PRODUCT, sel({ couponCode: "LUMEN10" })).discountCents).toBe(0);
  });

  it("clamps tips to the block max and 5% steps (tampered input)", () => {
    expect(computeTotals(DEMO_CONFIG, DEMO_PRODUCT, sel({ tipPercent: 90 })).tipPercent).toBe(25);
    expect(computeTotals(DEMO_CONFIG, DEMO_PRODUCT, sel({ tipPercent: 12 })).tipPercent).toBe(10);
    expect(computeTotals(DEMO_CONFIG, DEMO_PRODUCT, sel({ tipPercent: -50 })).tipPercent).toBe(0);
    expect(computeTotals(DEMO_CONFIG, DEMO_PRODUCT, sel({ tipPercent: Number.NaN })).tipPercent).toBe(0);
  });

  it("ignores add-ons when the upsell block is hidden", () => {
    const hidden: CheckoutConfig = { ...DEMO_CONFIG, blocks: DEMO_CONFIG.blocks.map((b) => (b.type === "upsell" ? { ...b, hidden: true } : b)) };
    expect(computeTotals(hidden, DEMO_PRODUCT, sel({ upsellAdded: true })).totalCents).toBe(4800);
  });
});

describe("test-mode guard", () => {
  it("rejects live keys", () => {
    expect(() => assertTestMode("sk_live_abc", "pk_test_abc")).toThrow(/TEST/);
    expect(() => assertTestMode("sk_test_abc", "pk_live_abc")).toThrow(/TEST/);
    expect(() => assertTestMode("sk_test_abc", "pk_test_abc")).not.toThrow();
  });
});
