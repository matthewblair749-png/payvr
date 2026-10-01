/**
 * Event ingest + analytics queries against the real Postgres in DATABASE_URL.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/events/route";
import { DEMO_CONFIG } from "@/lib/checkout/defaults";
import { db } from "@/server/db";
import { dropoff, funnel, methodsByCountry } from "@/server/dal/analytics";

const RUN = Math.random().toString(36).slice(2, 8);
let userId = "";
let merchantId = "";
let pageId = "";
let variantId = "";
const from = new Date(Date.now() - 86_400_000);
const to = new Date(Date.now() + 86_400_000);

async function ingest(body: unknown, ua = "Mozilla/5.0 (iPhone) Mobile", cookie?: string) {
  const res = await POST(
    new Request("http://x/api/events", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "user-agent": ua, "x-forwarded-for": `10.0.0.${RUN.length}`, ...(cookie ? { cookie } : {}) },
    }),
  );
  return res.status;
}

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `an-${RUN}@lumen.test` } });
  userId = user.id;
  merchantId = (await db.merchant.create({ data: { userId, name: "An" } })).id;
  const page = await db.checkoutPage.create({ data: { merchantId, name: "P", slug: `an-${RUN}`, draftConfig: DEMO_CONFIG, status: "PUBLISHED" } });
  pageId = page.id;
  const exp = await db.experiment.create({
    data: { merchantId, checkoutPageId: pageId, name: "E", status: "RUNNING", variants: { create: [{ key: "A", name: "A", isControl: true }] } },
    include: { variants: true },
  });
  variantId = exp.variants[0].id;
});

afterAll(async () => {
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

describe("POST /api/events", () => {
  it("stores events with server-derived device and validated variant; dedupes VIEW", async () => {
    const sessionId = crypto.randomUUID();
    expect(await ingest({ pageId, variantId, sessionId, events: [{ type: "VIEW", step: "view" }, { type: "FIELD_FOCUS", field: "coupon" }] })).toBe(204);
    expect(await ingest({ pageId, variantId, sessionId, events: [{ type: "VIEW", step: "view" }] })).toBe(204);
    const rows = await db.checkoutEvent.findMany({ where: { sessionId } });
    expect(rows.filter((r) => r.type === "VIEW")).toHaveLength(1);
    expect(rows.every((r) => r.device === "mobile" && r.variantId === variantId && r.merchantId === merchantId)).toBe(true);
  });

  it("drops a forged variant id and ignores unknown pages", async () => {
    const sessionId = crypto.randomUUID();
    await ingest({ pageId, variantId: "not-a-real-variant", sessionId, events: [{ type: "VIEW", step: "view" }] });
    expect((await db.checkoutEvent.findFirstOrThrow({ where: { sessionId } })).variantId).toBeNull();
    const other = crypto.randomUUID();
    expect(await ingest({ pageId: "nope", variantId: null, sessionId: other, events: [{ type: "VIEW" }] })).toBe(204);
    expect(await db.checkoutEvent.count({ where: { sessionId: other } })).toBe(0);
  });

  it("records visit context on the VIEW: source, visitor and the server's price", async () => {
    const sessionId = crypto.randomUUID();
    const vid = crypto.randomUUID();
    await ingest(
      { pageId, variantId: null, sessionId, events: [{ type: "VIEW", step: "view", ref: "l.instagram.com" }, { type: "FIELD_FOCUS", field: "shipping" }, { type: "STEP", step: "details" }] },
      undefined,
      `foo=1; lumen_vid=${vid}`,
    );
    const rows = await db.checkoutEvent.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
    expect(rows[0]).toMatchObject({ type: "VIEW", source: "instagram", visitorId: vid });
    // Only the VIEW carries context.
    expect(rows.slice(1).every((r) => r.source === null && r.visitorId === null)).toBe(true);
    expect(rows.map((r) => r.step ?? r.field)).toEqual(["view", "shipping", "details"]);
    // A referrer with a path or junk is refused outright (hostnames only).
    expect(await ingest({ pageId, variantId: null, sessionId: crypto.randomUUID(), events: [{ type: "VIEW", ref: "evil.com/path?x=1" }] })).toBe(400);
    // Keep this session out of the funnel counts asserted below.
    await db.checkoutEvent.deleteMany({ where: { sessionId } });
  });

  it("rejects malformed payloads (and never stores field values)", async () => {
    expect(await ingest({ pageId, variantId: null, sessionId: "x", events: [] })).toBe(400);
    expect(await ingest({ pageId, variantId: null, sessionId: crypto.randomUUID(), events: [{ type: "FIELD_FOCUS", field: "4242 4242" }] })).toBe(400);
  });
});

describe("analytics", () => {
  beforeAll(async () => {
    // Distinct, increasing timestamps (as real sessions have), two hours ago.
    let tick = Date.now() - 2 * 3_600_000;
    const mk = (sessionId: string, type: string, extra: Record<string, unknown> = {}) => ({
      merchantId, checkoutPageId: pageId, sessionId, type: type as "VIEW", device: "desktop", createdAt: new Date(tick++), ...extra,
    });
    const paid = crypto.randomUUID();
    const leftAtCoupon = crypto.randomUUID();
    const leftAtCard = crypto.randomUUID();
    await db.checkoutEvent.createMany({
      data: [
        mk(paid, "VIEW"), mk(paid, "FIELD_FOCUS", { field: "email" }), mk(paid, "PAY_CLICK"), mk(paid, "PAYMENT_SUCCEEDED"),
        mk(leftAtCoupon, "VIEW"), mk(leftAtCoupon, "FIELD_FOCUS", { field: "coupon" }),
        mk(leftAtCard, "VIEW"), mk(leftAtCard, "FIELD_FOCUS", { field: "email" }), mk(leftAtCard, "FIELD_FOCUS", { field: "card" }),
      ],
    });
    await db.order.createMany({
      data: [
        { merchantId, checkoutPageId: pageId, amountCents: 1000, currency: "usd", status: "SUCCEEDED", country: "DE", paymentMethod: "klarna" },
        { merchantId, checkoutPageId: pageId, amountCents: 1000, currency: "usd", status: "FAILED", country: "DE", paymentMethod: "card" },
        { merchantId, checkoutPageId: pageId, amountCents: 1000, currency: "usd", status: "PENDING", country: "DE", paymentMethod: "card" },
      ],
    });
  });

  const f = () => ({ merchantId, from, to, currency: "usd", pageId: null });

  it("builds the funnel from each session's furthest step", async () => {
    const fu = await funnel(f());
    // 5 sessions: 3 here + 2 from the ingest tests (one of which touched the coupon field)
    expect(fu.map((x) => x.sessions)).toEqual([5, 4, 2, 1, 1]);
  });

  it("attributes drop-off to the last field touched", async () => {
    const d = await dropoff(f());
    const cell = (field: string) => d.find((c) => c.field === field && c.device === "desktop");
    expect(cell("coupon")).toMatchObject({ touched: 1, exits: 1 });
    expect(cell("card")).toMatchObject({ touched: 1, exits: 1 });
    expect(cell("email")).toMatchObject({ touched: 2, exits: 0 });
  });

  it("counts payment attempts by country and method, ignoring pending", async () => {
    const m = await methodsByCountry(f());
    expect(m.find((c) => c.method === "klarna")).toMatchObject({ country: "DE", succeeded: 1, failed: 0 });
    expect(m.find((c) => c.method === "card")).toMatchObject({ succeeded: 0, failed: 1 });
  });

  it("never returns another merchant's data", async () => {
    const fu = await funnel({ ...f(), merchantId: "someone-else" });
    expect(fu.every((x) => x.sessions === 0)).toBe(true);
  });
});
