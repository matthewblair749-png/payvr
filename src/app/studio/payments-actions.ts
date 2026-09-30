"use server";

/** Studio server actions for payments: Connect onboarding, refunds, first-sale celebration. */
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { z } from "zod";
import { auth } from "@/server/auth";
import { markFirstSaleCelebrated, refundOrder } from "@/server/dal/orders";
import { merchantForAction } from "@/server/dal/session";
import { UserError } from "@/server/errors";
import { createOnboardingLink, expressDashboardLink } from "@/server/payments/connect";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import type { ActionResult } from "./actions";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function guarded<T>(fn: (merchantId: string) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const merchant = await merchantForAction();
    rateLimit(`mutate:${merchant.id}`, LIMITS.mutate.limit, LIMITS.mutate.windowMs);
    return { ok: true, data: await fn(merchant.id) };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    // Stripe errors carry a safe, user-facing message.
    if (e instanceof Stripe.errors.StripeError) return { ok: false, error: e.message };
    console.error("[payments action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function connectStripeAction(input: { country: string }) {
  const res = await guarded(async (merchantId) => {
    const country = z.string().regex(/^[A-Z]{2}$/).parse(input.country);
    const session = await auth();
    return createOnboardingLink(merchantId, { email: session?.user?.email, country, appUrl: appUrl() });
  });
  if (res.ok) redirect(res.data);
  return res;
}

export async function stripeDashboardAction() {
  const res = await guarded((merchantId) => expressDashboardLink(merchantId));
  if (res.ok) redirect(res.data);
  return res;
}

export async function refundOrderAction(input: { orderId: string }) {
  return guarded((merchantId) => refundOrder(merchantId, z.string().min(1).max(40).parse(input.orderId)));
}

export async function dismissFirstSaleAction() {
  return guarded(async (merchantId) => {
    await markFirstSaleCelebrated(merchantId);
    return null;
  });
}
