/**
 * Home funnel + drill-down (real Postgres).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "@/server/db";
import { funnelDrilldown, funnelOverview } from "@/server/dal/funnel";

const RUN = Math.random().toString(36).slice(2, 8);
const NOW = new Date("2026-06-15T12:00:00Z");
let userId = "";
let merchantId = "";

type Spec = { stage: 1 | 2 | 3 | 4 | 5; device: "mobile" | "desktop"; source?: string; visitor?: string; value?: number; daysAgo?: number; lastField?: string };

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `funnel-${RUN}@lumen.test` } });
  userId = user.id;
  merchantId = (await db.merchant.create({ data: { userId, name: "Funnel" } })).id;
  const pageId = (await db.checkoutPage.create({ data: { merchantId, name: "Mugs", slug: `funnel-${RUN}`, draftConfig: {} } })).id;

  const specs: Spec[] = [];
  const add = (count: number, s: Spec) => {
    for (let i = 0; i < count; i++) specs.push(s);
  };
  // Current 7 days, 100 desktop + 100 mobile visits.
  // Desktop: 10 bounce, 10 leave at details, 5 at payment, 75 pay.
  add(10, { stage: 1, device: "desktop" });
  add(10, { stage: 2, device: "desktop", lastField: "email" });
  add(5, { stage: 3, device: "desktop" });
  add(75, { stage: 5, device: "desktop" });
  // Mobile: 10 bounce, 50 leave at details (mostly at shipping), 5 at payment, 35 pay.
  add(10, { stage: 1, device: "mobile" });
  add(40, { stage: 2, device: "mobile", lastField: "shipping" });
  add(10, { stage: 2, device: "mobile", lastField: "email" });
  add(5, { stage: 3, device: "mobile" });
  add(35, { stage: 5, device: "mobile" });
  // Previous period: 40 visits, 10 left at details.
  add(30, { stage: 5, device: "desktop", daysAgo: 9 });
  add(10, { stage: 2, device: "mobile", daysAgo: 9, lastField: "shipping" });

  const events = specs.flatMap((s, i) => {
    const sessionId = `${RUN}-${i}`;
    const at = (min: number) => new Date(NOW.getTime() - (s.daysAgo ?? 1) * 86_400_000 + min * 60_000);
    const base = { merchantId, checkoutPageId: pageId, sessionId, device: s.device };
    const ev = [{ ...base, type: "VIEW" as const, step: "view", source: s.source ?? (i % 2 ? "email" : "instagram"), visitorId: `${RUN}-v${i}`, valueCents: s.value ?? 4800, createdAt: at(0) }];
    if (s.stage >= 2) ev.push({ ...base, type: "FIELD_FOCUS" as never, field: s.lastField ?? "email", createdAt: at(1) } as never);
    if (s.stage >= 3) ev.push({ ...base, type: "STEP" as never, step: "details", createdAt: at(2) } as never);
    if (s.stage >= 4) ev.push({ ...base, type: "FIELD_FOCUS" as never, field: "card", createdAt: at(3) } as never);
    if (s.stage >= 5) ev.push({ ...base, type: "PAYMENT_SUCCEEDED" as never, step: "paid", createdAt: at(4) } as never);
    return ev;
  });
  await db.checkoutEvent.createMany({ data: events });
  // AOV $40 over the paid sessions.
  await db.order.createMany({
    data: Array.from({ length: 110 }, () => ({ merchantId, amountCents: 4000, currency: "usd", status: "SUCCEEDED" as const, createdAt: new Date(NOW.getTime() - 86_400_000) })),
  });
});

afterAll(async () => {
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

describe("funnelOverview", () => {
  it("counts each stage, the drop between them, and finds the costliest leak", async () => {
    const f = await funnelOverview(merchantId, "usd", 7, NOW);
    expect(f.stages.map((s) => s.sessions)).toEqual([200, 180, 120, 110, 110]);
    expect(f.stages.map((s) => s.prevSessions)).toEqual([40, 40, 30, 30, 30]);
    const details = f.transitions.find((t) => t.to === "details")!;
    expect(details).toMatchObject({ reached: 180, continued: 120, lost: 60 });
    expect(details.dropRate).toBeCloseTo(1 / 3);
    expect(details.prevDropRate).toBeCloseTo(0.25);
    expect(f.biggestLeak).toBe("details");
    expect(f.aovCents).toBe(4000);
  });
});

describe("funnelDrilldown", () => {
  it("segments the leak and names the worst segment and where they left", async () => {
    const d = await funnelDrilldown(merchantId, "usd", 7, "details", NOW);
    expect(d.title).toBe("Didn't finish their details");
    const device = d.dimensions.find((x) => x.key === "device")!;
    expect(device.rows.map((r) => [r.value, r.reached, r.lost])).toEqual([
      ["mobile", 90, 50],
      ["desktop", 90, 10],
    ]);
    expect(d.worst).toMatchObject({ dimension: "device", value: "mobile" });
    expect(d.worst!.othersDropRate).toBeCloseTo(10 / 90);
    expect(d.lastFields[0]).toMatchObject({ field: "shipping", label: "Shipping address", count: 40 });
    // No usable previous rate for mobile, so the target closes half the gap:
    // 50/90 → 30/90, keeping 20 shoppers; × (110 paid / 120 continued) × $40.
    expect(d.worst).toMatchObject({ basis: "half" });
    expect(d.worst!.recoverable).toBeCloseTo(20);
    expect(d.opportunityCents).toBe(Math.round(20 * (110 / 120) * 4000));
    expect(d.dimensions.find((x) => x.key === "visitor")!.rows[0]).toMatchObject({ value: "new", reached: 180 });
  });

  it("tells the demo shop's shipping story quickly", async () => {
    const demo = await db.merchant.findFirst({ where: { user: { email: "demo@lumen.test" } } });
    if (!demo) return; // seed not loaded
    const t = performance.now();
    const [f, d] = await Promise.all([funnelOverview(demo.id, "usd", 30), funnelDrilldown(demo.id, "usd", 30, "details")]);
    const ms = performance.now() - t;
    for (const dim of d.dimensions) console.log(dim.key, dim.rows.map((r) => `${r.label}: ${r.reached} reached, ${(r.dropRate * 100).toFixed(1)}% left`).join(" | "));
    console.log(`demo funnel+drilldown 30d: ${Math.round(ms)}ms`, f.stages.map((s) => s.sessions), "leak:", f.biggestLeak, "worst:", d.worst?.label, d.lastFields[0]?.label);
    expect(f.biggestLeak).toBe("details");
    expect(d.worst?.value).toBe("mobile");
    expect(d.lastFields[0]?.field).toBe("shipping");
    expect(ms).toBeLessThan(800);
  });
});
