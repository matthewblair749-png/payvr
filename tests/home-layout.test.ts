/** Home's rearrangeable layout: stored data is always made whole and safe. */
import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, move, normalizeLayout, normalizeViews, rows, SECTION_KEYS } from "@/lib/home-layout";

describe("normalizeLayout", () => {
  it("falls back to the default for missing or junk data", () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout({ order: ["nope"], hidden: [] })).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout("x")).toEqual(DEFAULT_LAYOUT);
  });

  it("keeps the merchant's order, drops duplicates and adds sections it didn't know about", () => {
    const l = normalizeLayout({ order: ["funnel", "brief", "funnel"], hidden: ["why", "why"] });
    expect(l.order.slice(0, 2)).toEqual(["funnel", "brief"]);
    expect([...l.order].sort()).toEqual([...SECTION_KEYS].sort());
    expect(l.hidden).toEqual(["why"]);
  });
});

describe("move and rows", () => {
  it("moves a section and stops at the ends", () => {
    expect(move(DEFAULT_LAYOUT, "northStar", -1).order.slice(0, 2)).toEqual(["northStar", "brief"]);
    expect(move(DEFAULT_LAYOUT, "brief", -1)).toBe(DEFAULT_LAYOUT);
  });

  it("puts neighbouring small cards in one row and skips hidden ones", () => {
    expect(rows(DEFAULT_LAYOUT)).toEqual([["brief"], ["northStar"], ["kpis"], ["funnel"], ["feed", "why", "experiment"]]);
    const l = { order: ["feed", "funnel", "why", "experiment", "brief", "northStar", "kpis"] as typeof SECTION_KEYS, hidden: ["experiment"] as typeof SECTION_KEYS };
    expect(rows(l)).toEqual([["feed"], ["funnel"], ["why"], ["brief"], ["northStar"], ["kpis"]]);
  });
});

describe("normalizeViews", () => {
  it("keeps valid views, repairs their layouts and drops the rest", () => {
    const v = normalizeViews([
      { id: "a", name: "Monday", range: "7", order: ["funnel"], hidden: [] },
      { id: "b", name: "", range: "7", order: [], hidden: [] },
      { id: "c", name: "Bad range", range: "365", order: [], hidden: [] },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].order[0]).toBe("funnel");
    expect(v[0].order).toHaveLength(SECTION_KEYS.length);
  });
});
