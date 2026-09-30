/**
 * Integration tests against the real Postgres in DATABASE_URL.
 * Stripe is never called: webhooks are signed locally with a test secret,
 * and PaymentIntent creation uses a stand-in client that records its params.
 */
import "dotenv/config";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_CONFIG } from "@/lib/checkout/defaults";
import { POST } from "@/app/api/stripe/webhook/route";
import { db } from "@/server/db";
import { preparePayment } from "@/server/payments/checkout";
import { __setStripeForTests } from "@/server/stripe";

const SECRET = "whsec_test_integration_secret";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_fake";

const signer = new Stripe("sk_test_fake").webhooks;
const RUN = Math.random().toString(36).slice(2, 8);
const SLUG = `itest-${RUN}`;
let merchantId = "";
let pageId = "";
let userId = "";

let counter = 0;
async function send(type: string, object: Record<string, unknown>, opts: { id?: string; badSig?: boolean } = {}) {
  const payload = JSON.stringify({ id: opts.id ?? `evt_${RUN}_${counter++}`, object: "event", type, data: { object }, created: 0, livemode: false });
  const header = signer.generateTestHeaderString({ payload, secret: opts.badSig ? "whsec_wrong" : SECRET });
  const res = await POST(new Request("http://x/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
  return { status: res.status, body: (await res.json()) as { outcome?: string } };
}

async function newOrder(pi: string) {
  return db.order.create({
    data: { merchantId, checkoutPageId: pageId, amountCents: 4800, currency: "usd", stripePaymentIntentId: pi, sessionId: crypto.randomUUID() },
  });
}

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `itest-${RUN}@lumen.test` } });
  userId = user.id;
  const merchant = await db.merchant.create({
    data: { userId: user.id, name: "ITest", stripeAccountId: `acct_itest${RUN}`, stripeChargesEnabled: true },
  });
  merchantId = merchant.id;
  const product = await db.product.create({ data: { merchantId, name: "Mug", priceCents: 4800, currency: "usd" } });
  const page = await db.checkoutPage.create({ data: { merchantId, productId: product.id, name: "T", slug: SLUG, draftConfig: DEMO_CONFIG } });
  const v = await db.checkoutPageVersion.create({ data: { checkoutPageId: page.id, number: 1, config: DEMO_CONFIG } });
  await db.checkoutPage.update({ where: { id: page.id }, data: { status: "PUBLISHED", publishedVersionId: v.id } });
  pageId = page.id;
});

afterAll(async () => {
  await db.user.delete({ where: { id: userId } });
  await db.stripeEvent.deleteMany({ where: { id: { startsWith: `evt_${RUN}` } } });
  await db.$disconnect();
});

describe("webhook security", () => {
  it("rejects a bad signature", async () => {
    const r = await send("payment_intent.succeeded", { id: "pi_x" }, { badSig: true });
    expect(r.status).toBe(400);
  });
  it("ignores events we don't handle", async () => {
    expect((await send("customer.created", { id: "cus_1" })).body.outcome).toBe("ignored");
  });
});

describe("payment lifecycle", () => {
  it("marks paid, records the first sale, and is idempotent", async () => {
    const order = await newOrder(`pi_${RUN}_a`);
    await send("charge.succeeded", {
      id: `ch_${RUN}_a`,
      payment_intent: `pi_${RUN}_a`,
      amount: 4800,
      payment_method_details: { type: "card", card: { country: "CA", wallet: { type: "apple_pay" } } },
      billing_details: { email: "buyer@example.com", address: {} },
    });
    const evtId = `evt_${RUN}_paid`;
    const first = await send("payment_intent.succeeded", { id: `pi_${RUN}_a`, amount: 4800, amount_received: 4800 }, { id: evtId });
    const dup = await send("payment_intent.succeeded", { id: `pi_${RUN}_a`, amount: 4800, amount_received: 4800 }, { id: evtId });
    expect(first.body.outcome).toBe("processed");
    expect(dup.body.outcome).toBe("duplicate");

    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("SUCCEEDED");
    expect(o.paymentMethod).toBe("apple_pay");
    expect(o.country).toBe("CA");
    expect(o.customerEmail).toBe("buyer@example.com");
    expect((await db.merchant.findUniqueOrThrow({ where: { id: merchantId } })).firstSaleAt).not.toBeNull();
    expect(await db.checkoutEvent.count({ where: { sessionId: o.sessionId!, type: "PAYMENT_SUCCEEDED" } })).toBe(1);
  });

  it("does not let a late payment_failed downgrade a paid order", async () => {
    const order = await newOrder(`pi_${RUN}_b`);
    await send("payment_intent.succeeded", { id: `pi_${RUN}_b`, amount: 4800, amount_received: 4800 });
    await send("payment_intent.payment_failed", { id: `pi_${RUN}_b`, last_payment_error: { message: "Your card was declined." } });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SUCCEEDED");
  });

  it("records declines on pending orders", async () => {
    const order = await newOrder(`pi_${RUN}_c`);
    await send("payment_intent.payment_failed", { id: `pi_${RUN}_c`, last_payment_error: { message: "Your card has insufficient funds." } });
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("FAILED");
    expect(o.failureMessage).toMatch(/insufficient/);
  });

  it("tracks partial then full refunds", async () => {
    const order = await newOrder(`pi_${RUN}_d`);
    await send("payment_intent.succeeded", { id: `pi_${RUN}_d`, amount: 4800, amount_received: 4800 });
    await send("charge.refunded", { id: `ch_${RUN}_d`, payment_intent: `pi_${RUN}_d`, amount: 4800, amount_refunded: 1000 });
    let o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect([o.status, o.refundedCents]).toEqual(["PARTIALLY_REFUNDED", 1000]);
    await send("charge.refunded", { id: `ch_${RUN}_d`, payment_intent: `pi_${RUN}_d`, amount: 4800, amount_refunded: 4800 });
    o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect([o.status, o.refundedCents]).toEqual(["REFUNDED", 4800]);
  });

  it("handles disputes (won and lost)", async () => {
    const won = await newOrder(`pi_${RUN}_e`);
    const lost = await newOrder(`pi_${RUN}_f`);
    for (const pi of [`pi_${RUN}_e`, `pi_${RUN}_f`]) {
      await send("payment_intent.succeeded", { id: pi, amount: 4800, amount_received: 4800 });
      await send("charge.dispute.created", { id: `dp_${pi}`, payment_intent: pi, status: "needs_response" });
    }
    expect((await db.order.findUniqueOrThrow({ where: { id: won.id } })).status).toBe("DISPUTED");
    await send("charge.dispute.closed", { id: `dp_pi_${RUN}_e`, payment_intent: `pi_${RUN}_e`, status: "won" });
    await send("charge.dispute.closed", { id: `dp_pi_${RUN}_f`, payment_intent: `pi_${RUN}_f`, status: "lost" });
    expect((await db.order.findUniqueOrThrow({ where: { id: won.id } })).status).toBe("SUCCEEDED");
    expect((await db.order.findUniqueOrThrow({ where: { id: lost.id } })).status).toBe("REFUNDED");
  });

  it("syncs Connect account status", async () => {
    await db.merchant.update({ where: { id: merchantId }, data: { stripePayoutsEnabled: false } });
    await send("account.updated", { id: `acct_itest${RUN}`, charges_enabled: true, payouts_enabled: true, details_submitted: true });
    expect((await db.merchant.findUniqueOrThrow({ where: { id: merchantId } })).stripePayoutsEnabled).toBe(true);
  });
});

describe("preparePayment (server-side pricing)", () => {
  const calls: { method: string; params: Record<string, unknown>; opts?: Record<string, unknown> }[] = [];
  const status = "requires_payment_method";
  const fake = {
    paymentIntents: {
      create: async (params: Record<string, unknown>, opts: Record<string, unknown>) => {
        calls.push({ method: "create", params, opts });
        return { id: `pi_${RUN}_new`, client_secret: "pi_secret_1", amount: params.amount, currency: params.currency, status };
      },
      retrieve: async () => ({ id: `pi_${RUN}_new`, client_secret: "pi_secret_1", amount: 5940, currency: "usd", status }),
      update: async (id: string, params: Record<string, unknown>) => {
        calls.push({ method: "update", params });
        return { id, client_secret: "pi_secret_1", amount: params.amount, currency: "usd", status };
      },
    },
  };
  beforeAll(() => __setStripeForTests(fake as unknown as Stripe));
  afterAll(() => __setStripeForTests(null));

  const sessionId = crypto.randomUUID();

  it("computes the amount on the server and charges on behalf of the merchant", async () => {
    const res = await preparePayment(
      { slug: SLUG, sessionId, orderId: null, device: "mobile", selections: { upsellAdded: true, tipPercent: 10, couponCode: "lumen10", payIn4: false } },
      "visitor-1",
    );
    expect(res.amountCents).toBe(5940);
    const c = calls.find((x) => x.method === "create")!;
    expect(c.params.amount).toBe(5940);
    expect(c.params.on_behalf_of).toBe(`acct_itest${RUN}`);
    expect(c.params.transfer_data).toEqual({ destination: `acct_itest${RUN}` });
    expect(c.opts?.idempotencyKey).toBe(`pi_create_${res.orderId}`);
    const order = await db.order.findUniqueOrThrow({ where: { id: res.orderId } });
    expect([order.status, order.amountCents, order.tipCents, order.discountCents]).toEqual(["PENDING", 5940, 540, 600]);
  });

  it("reuses the same PaymentIntent when the buyer changes their tip", async () => {
    const order = await db.order.findFirstOrThrow({ where: { sessionId } });
    const res = await preparePayment(
      { slug: SLUG, sessionId, orderId: order.id, device: "mobile", selections: { upsellAdded: true, tipPercent: 999, couponCode: "lumen10", payIn4: false } },
      "visitor-1",
    );
    expect(res.orderId).toBe(order.id);
    // Tip clamped to 25%: 5400 + 1350
    expect(res.amountCents).toBe(6750);
    expect(calls.filter((c) => c.method === "create")).toHaveLength(1);
    expect(calls.find((c) => c.method === "update")!.params.amount).toBe(6750);
  });

  it("refuses when the merchant can't take payments", async () => {
    await db.merchant.update({ where: { id: merchantId }, data: { stripeChargesEnabled: false } });
    await expect(
      preparePayment({ slug: SLUG, sessionId, orderId: null, device: null, selections: { upsellAdded: false, tipPercent: 0, couponCode: null, payIn4: false } }, "v"),
    ).rejects.toThrow(/isn't taking payments/);
    await db.merchant.update({ where: { id: merchantId }, data: { stripeChargesEnabled: true } });
  });
});
