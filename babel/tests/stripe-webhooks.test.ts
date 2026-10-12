import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEntitlement } from "@/features/billing/entitlements";
import { handleStripeEvent, mirrorFields } from "@/features/billing/webhooks";
import { createUser, describeDb, testDb } from "./helpers/db";
import { fakeCheckoutSession, fakeEvent, fakeFailedInvoice, fakeSubscription } from "./helpers/stripe-fixtures";

describe("mirrorFields", () => {
  it("reads plan and interval from the price lookup key, and the period from the item", () => {
    const sub = fakeSubscription({ customer: "cus_1", lookupKey: "babel_teams_annual", quantity: 6, periodEnd: 1_800_000_000 });
    expect(mirrorFields(sub)).toMatchObject({
      plan: "teams",
      interval: "annual",
      seats: 6,
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
    });
  });

  it("refuses prices that aren't Babel's", () => {
    expect(() => mirrorFields(fakeSubscription({ customer: "cus_1", lookupKey: "someone_else" }))).toThrow(/lookup key/);
  });
});

describeDb("Stripe webhook handling (Postgres)", () => {
  let subs: Map<string, Stripe.Subscription>;
  const retrieveSubscription = vi.fn(async (id: string) => {
    const sub = subs.get(id);
    if (!sub) throw new Error(`no such subscription ${id}`);
    return sub;
  });
  const deps = () => ({ db: testDb, retrieveSubscription });

  beforeEach(() => {
    subs = new Map();
    retrieveSubscription.mockClear();
  });

  /** A user who has just completed Checkout for Plus monthly. */
  async function checkedOutUser() {
    const user = await createUser();
    const customer = `cus_${randomUUID()}`;
    const sub = fakeSubscription({ customer, userId: user.id });
    subs.set(sub.id, sub);
    const event = fakeEvent("checkout.session.completed", fakeCheckoutSession({ subscription: sub.id, customer, userId: user.id }));
    expect(await handleStripeEvent(event, deps())).toBe("processed");
    return { user, customer, sub };
  }

  const rowFor = (userId: string) => testDb.subscription.findUniqueOrThrow({ where: { userId } });

  it("checkout.session.completed creates the subscription and links the customer", async () => {
    const { user, customer, sub } = await checkedOutUser();
    const row = await rowFor(user.id);
    expect(row).toMatchObject({ stripeSubscriptionId: sub.id, plan: "plus", interval: "monthly", status: "active" });
    expect((await testDb.user.findUniqueOrThrow({ where: { id: user.id } })).stripeCustomerId).toBe(customer);
    expect(resolveEntitlement(row).plan.id).toBe("plus");
  });

  it("is idempotent: the same event twice changes nothing the second time", async () => {
    const { user, customer, sub } = await checkedOutUser();
    const upgrade = fakeEvent("customer.subscription.updated", fakeSubscription({ id: sub.id, customer, userId: user.id, lookupKey: "babel_pro_monthly" }));
    expect(await handleStripeEvent(upgrade, deps())).toBe("processed");
    const before = await rowFor(user.id);
    expect(await handleStripeEvent(upgrade, deps())).toBe("duplicate");
    expect(await rowFor(user.id)).toEqual(before);
  });

  it("handles the same event delivered twice at the same moment", async () => {
    const { user, customer, sub } = await checkedOutUser();
    const event = fakeEvent("customer.subscription.updated", fakeSubscription({ id: sub.id, customer, userId: user.id, lookupKey: "babel_pro_annual" }));
    const outcomes = await Promise.all([handleStripeEvent(event, deps()), handleStripeEvent(event, deps())]);
    expect(outcomes.sort()).toEqual(["duplicate", "processed"]);
    expect((await rowFor(user.id)).plan).toBe("pro");
  });

  it("ignores an older event that arrives late", async () => {
    const { user, customer, sub } = await checkedOutUser();
    const older = fakeEvent("customer.subscription.updated", fakeSubscription({ id: sub.id, customer, lookupKey: "babel_plus_monthly" }));
    const newer = fakeEvent("customer.subscription.updated", fakeSubscription({ id: sub.id, customer, lookupKey: "babel_pro_monthly" }));
    expect(await handleStripeEvent(newer, deps())).toBe("processed");
    expect(await handleStripeEvent(older, deps())).toBe("stale");
    expect((await rowFor(user.id)).plan).toBe("pro");
  });

  it("customer.subscription.updated records cancel-at-period-end", async () => {
    const { user, customer, sub } = await checkedOutUser();
    await handleStripeEvent(fakeEvent("customer.subscription.updated", fakeSubscription({ id: sub.id, customer, cancelAtPeriodEnd: true })), deps());
    const row = await rowFor(user.id);
    expect(row.cancelAtPeriodEnd).toBe(true);
    expect(resolveEntitlement(row).access.kind).toBe("ending");
  });

  it("customer.subscription.deleted moves the user to Free", async () => {
    const { user, customer, sub } = await checkedOutUser();
    await handleStripeEvent(fakeEvent("customer.subscription.deleted", fakeSubscription({ id: sub.id, customer, status: "canceled" })), deps());
    const row = await rowFor(user.id);
    expect(row.status).toBe("canceled");
    expect(resolveEntitlement(row).plan.id).toBe("free");
  });

  it("a late 'deleted' for an old subscription doesn't cancel the new one", async () => {
    const { user, customer, sub: oldSub } = await checkedOutUser();
    const newSub = fakeSubscription({ customer, userId: user.id, lookupKey: "babel_pro_monthly" });
    subs.set(newSub.id, newSub);
    await handleStripeEvent(fakeEvent("checkout.session.completed", fakeCheckoutSession({ subscription: newSub.id, customer, userId: user.id })), deps());
    await handleStripeEvent(fakeEvent("customer.subscription.deleted", fakeSubscription({ id: oldSub.id, customer, status: "canceled" })), deps());
    const row = await rowFor(user.id);
    expect(row).toMatchObject({ stripeSubscriptionId: newSub.id, plan: "pro", status: "active" });
  });

  it("invoice.payment_failed starts a 7-day grace period, once", async () => {
    const { user, sub } = await checkedOutUser();
    const failure = fakeEvent("invoice.payment_failed", fakeFailedInvoice(sub.id));
    expect(await handleStripeEvent(failure, deps())).toBe("processed");
    const row = await rowFor(user.id);
    const failedAt = new Date(failure.created * 1000);
    expect(row.paymentFailedAt).toEqual(failedAt);
    expect(row.graceEndsAt).toEqual(new Date(failedAt.getTime() + 7 * 24 * 3600 * 1000));
    expect(resolveEntitlement(row, failedAt).access.kind).toBe("grace");

    // A second failed retry doesn't extend the grace period.
    await handleStripeEvent(fakeEvent("invoice.payment_failed", fakeFailedInvoice(sub.id)), deps());
    expect((await rowFor(user.id)).graceEndsAt).toEqual(row.graceEndsAt);
  });

  it("clears the payment problem once the subscription is active again", async () => {
    const { user, customer, sub } = await checkedOutUser();
    await handleStripeEvent(fakeEvent("invoice.payment_failed", fakeFailedInvoice(sub.id)), deps());
    await handleStripeEvent(fakeEvent("customer.subscription.updated", fakeSubscription({ id: sub.id, customer, status: "active" })), deps());
    const row = await rowFor(user.id);
    expect(row.paymentFailedAt).toBeNull();
    expect(row.graceEndsAt).toBeNull();
  });

  it("handles a payment failure that arrives before checkout.session.completed", async () => {
    const user = await createUser();
    const customer = `cus_${randomUUID()}`;
    const sub = fakeSubscription({ customer, userId: user.id, status: "past_due" });
    subs.set(sub.id, sub);
    expect(await handleStripeEvent(fakeEvent("invoice.payment_failed", fakeFailedInvoice(sub.id)), deps())).toBe("processed");
    const row = await rowFor(user.id);
    expect(row.paymentFailedAt).not.toBeNull();
    expect(retrieveSubscription).toHaveBeenCalledWith(sub.id);
  });

  it("ignores events it doesn't handle, and one-off payments", async () => {
    expect(await handleStripeEvent(fakeEvent("customer.created", { id: "cus_x" }), deps())).toBe("ignored");
    const payment = { ...fakeCheckoutSession({ subscription: "", customer: "cus_x", userId: "u" }), mode: "payment" };
    expect(await handleStripeEvent(fakeEvent("checkout.session.completed", payment), deps())).toBe("ignored");
  });

  it("doesn't record an event whose processing failed, so Stripe's retry can succeed", async () => {
    const user = await createUser();
    const customer = `cus_${randomUUID()}`;
    const bad = fakeSubscription({ customer, userId: user.id, lookupKey: "not_ours" });
    subs.set(bad.id, bad);
    const event = fakeEvent("checkout.session.completed", fakeCheckoutSession({ subscription: bad.id, customer, userId: user.id }));
    await expect(handleStripeEvent(event, deps())).rejects.toThrow(/lookup key/);
    expect(await testDb.stripeEvent.findUnique({ where: { id: event.id } })).toBeNull();
    expect(await testDb.subscription.findUnique({ where: { userId: user.id } })).toBeNull();
  });
});

describe("webhook signature verification", () => {
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_sig", object: "event", type: "customer.created", created: 1, data: { object: {} } });
  const stripe = new Stripe("sk_test_dummy");

  async function post(body: string, signature: string | null) {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const headers = new Headers({ "content-type": "application/json" });
    if (signature) headers.set("stripe-signature", signature);
    return POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body, headers }));
  }

  it("rejects a missing signature", async () => {
    expect((await post(payload, null)).status).toBe(400);
  });

  it("rejects a forged signature", async () => {
    const forged = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    expect((await post(payload, forged)).status).toBe(400);
  });

  it("rejects a body changed after signing", async () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect((await post(payload.replace("customer.created", "invoice.payment_failed"), signature)).status).toBe(400);
  });

  it("accepts a correctly signed event", async () => {
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const response = await post(payload, signature);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "ignored" });
  });
});
