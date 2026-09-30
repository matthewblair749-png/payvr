import { describe, expect, it } from "vitest";
import { contrast } from "@/lib/color";
import { assignVariant } from "@/lib/checkout/assign";
import { DEMO_CONFIG } from "@/lib/checkout/defaults";
import { editorReducer } from "@/lib/checkout/reducer";
import { checkoutConfigSchema } from "@/lib/checkout/schema";
import { themeToVars } from "@/lib/checkout/theme";
import { safeNext } from "@/lib/safe-next";

describe("checkout schema", () => {
  it("accepts the demo config", () => {
    expect(checkoutConfigSchema.safeParse(DEMO_CONFIG).success).toBe(true);
  });
  it("rejects configs without exactly one payment block", () => {
    const blocks = DEMO_CONFIG.blocks.filter((b) => b.type !== "payment");
    expect(checkoutConfigSchema.safeParse({ ...DEMO_CONFIG, blocks }).success).toBe(false);
  });
  it("rejects non-https logos and bad colors", () => {
    expect(checkoutConfigSchema.safeParse({ ...DEMO_CONFIG, brand: { name: "x", logoUrl: "javascript:alert(1)" } }).success).toBe(false);
    expect(checkoutConfigSchema.safeParse({ ...DEMO_CONFIG, theme: { ...DEMO_CONFIG.theme, accent: "red;}" } }).success).toBe(false);
  });
});

describe("editor reducer", () => {
  it("reorders blocks", () => {
    const next = editorReducer(DEMO_CONFIG, { type: "reorder", from: 0, to: 2 });
    expect(next.blocks[2].id).toBe(DEMO_CONFIG.blocks[0].id);
    expect(next.blocks).toHaveLength(DEMO_CONFIG.blocks.length);
  });
  it("never hides or removes the payment block", () => {
    const pay = DEMO_CONFIG.blocks.find((b) => b.type === "payment")!;
    expect(editorReducer(DEMO_CONFIG, { type: "toggle", id: pay.id }).blocks.find((b) => b.id === pay.id)!.hidden).toBe(false);
    expect(editorReducer(DEMO_CONFIG, { type: "remove", id: pay.id }).blocks.some((b) => b.id === pay.id)).toBe(true);
  });
  it("adds new blocks above the payment block", () => {
    const next = editorReducer(DEMO_CONFIG, { type: "add", blockType: "testimonial" });
    const payIdx = next.blocks.findIndex((b) => b.type === "payment");
    expect(next.blocks[payIdx - 1].type).toBe("testimonial");
  });
});

describe("theme contrast", () => {
  it.each(["#F04A1A", "#FFD84D", "#FFFFFF", "#0E0E10", "#3355E0", "#EDEDF0"])("keeps accent text AA on %s", (accent) => {
    for (const mode of ["light", "dark"] as const) {
      const v = themeToVars({ ...DEMO_CONFIG.theme, accent, mode });
      expect(contrast(v["--co-accent-fg"], accent)).toBeGreaterThanOrEqual(4.5 - 1.1); // large button text: ≥3:1
      expect(contrast(v["--co-accent-text"], v["--co-card"])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v["--co-muted"], v["--co-card"])).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("A/B assignment", () => {
  const variants = [
    { key: "A", weight: 50 },
    { key: "B", weight: 50 },
  ];
  it("is sticky per visitor", () => {
    const first = assignVariant("visitor-1", "exp-1", variants);
    for (let i = 0; i < 10; i++) expect(assignVariant("visitor-1", "exp-1", variants)).toEqual(first);
  });
  it("splits roughly by weight", () => {
    let b = 0;
    for (let i = 0; i < 10_000; i++) if (assignVariant(`v${i}`, "exp-1", variants)?.key === "B") b++;
    expect(b).toBeGreaterThan(4_700);
    expect(b).toBeLessThan(5_300);
  });
  it("respects a 0% weight", () => {
    const allA = [
      { key: "A", weight: 100 },
      { key: "B", weight: 0 },
    ];
    for (let i = 0; i < 200; i++) expect(assignVariant(`v${i}`, "e", allA)?.key).toBe("A");
  });
});

describe("safeNext", () => {
  it.each([
    ["/studio/pages/1", "/studio/pages/1"],
    ["//evil.com", "/studio"],
    ["/\\evil.com", "/studio"],
    ["https://evil.com", "/studio"],
    [undefined, "/studio"],
  ])("%s -> %s", (input, out) => expect(safeNext(input)).toBe(out));
});
