/**
 * One-tap survey answers: validation and anti-spam rules (real Postgres).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_CONFIG } from "@/lib/checkout/defaults";
import { checkoutConfigSchema } from "@/lib/checkout/schema";
import { db } from "@/server/db";
import { recordSurveyAnswer } from "@/server/survey";

const RUN = Math.random().toString(36).slice(2, 8);
const SLUG = `sv-${RUN}`;
let userId = "";
let pageId = "";
let merchantId = "";

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `sv-${RUN}@lumen.test` } });
  userId = user.id;
  merchantId = (await db.merchant.create({ data: { userId, name: "Sv" } })).id;
  const product = await db.product.create({ data: { merchantId, name: "Mug", priceCents: 4800 } });
  const config = { ...DEMO_CONFIG, survey: { enabled: true, question: "heard_about" as const } };
  const page = await db.checkoutPage.create({ data: { merchantId, productId: product.id, name: "S", slug: SLUG, draftConfig: config } });
  const v = await db.checkoutPageVersion.create({ data: { checkoutPageId: page.id, number: 1, config } });
  await db.checkoutPage.update({ where: { id: page.id }, data: { status: "PUBLISHED", publishedVersionId: v.id } });
  pageId = page.id;
});

afterAll(async () => {
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

async function orderFor(sessionId: string, status: "PENDING" | "SUCCEEDED" | "FAILED" = "SUCCEEDED") {
  return db.order.create({ data: { merchantId, checkoutPageId: pageId, amountCents: 4800, currency: "usd", status, sessionId } });
}

describe("recordSurveyAnswer", () => {
  it("records one answer per session, linked to the order", async () => {
    const sessionId = crypto.randomUUID();
    const order = await orderFor(sessionId);
    expect(await recordSurveyAnswer({ slug: SLUG, sessionId, question: "heard_about", answer: "instagram" }, "v")).toBe("recorded");
    expect(await recordSurveyAnswer({ slug: SLUG, sessionId, question: "heard_about", answer: "tiktok" }, "v")).toBe("duplicate");
    const rows = await db.surveyResponse.findMany({ where: { sessionId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ answer: "instagram", orderId: order.id, merchantId });
  });

  it("accepts answers while the payment webhook is still in flight (PENDING order)", async () => {
    const sessionId = crypto.randomUUID();
    await orderFor(sessionId, "PENDING");
    expect(await recordSurveyAnswer({ slug: SLUG, sessionId, question: "heard_about", answer: "friend" }, "v")).toBe("recorded");
  });

  it("rejects answers without a real order (spam)", async () => {
    await expect(
      recordSurveyAnswer({ slug: SLUG, sessionId: crypto.randomUUID(), question: "heard_about", answer: "google" }, "v"),
    ).rejects.toThrow(/order/);
    const failed = crypto.randomUUID();
    await orderFor(failed, "FAILED");
    await expect(recordSurveyAnswer({ slug: SLUG, sessionId: failed, question: "heard_about", answer: "google" }, "v")).rejects.toThrow(/order/);
  });

  it("rejects a question the checkout doesn't ask, or an unknown answer", async () => {
    const sessionId = crypto.randomUUID();
    await orderFor(sessionId);
    await expect(recordSurveyAnswer({ slug: SLUG, sessionId, question: "nearly_stopped", answer: "price" }, "v")).rejects.toThrow(/doesn't ask/);
    await expect(recordSurveyAnswer({ slug: SLUG, sessionId, question: "heard_about", answer: "<script>" }, "v")).rejects.toThrow(/isn't one/);
    await expect(recordSurveyAnswer({ slug: SLUG, sessionId, question: "heard_about", answer: "__proto__" }, "v")).rejects.toThrow(/isn't one/);
  });
});

describe("survey config", () => {
  it("defaults on for configs saved before the survey existed", () => {
    const { survey, ...legacy } = DEMO_CONFIG;
    void survey;
    expect(checkoutConfigSchema.parse(legacy).survey).toEqual({ enabled: true, question: "nearly_stopped" });
  });
});
