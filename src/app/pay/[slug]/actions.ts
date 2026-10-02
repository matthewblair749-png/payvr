"use server";

import { cookies, headers } from "next/headers";
import Stripe from "stripe";
import { z } from "zod";
import { UserError } from "@/server/errors";
import { prepareInputSchema, preparePayment, type PreparedPayment } from "@/server/payments/checkout";
import { recordSurveyAnswer, surveyInputSchema } from "@/server/survey";
import { rateLimit } from "@/server/rate-limit";
import { clientIpFromHeaders } from "@/server/request-meta";

export type PayActionResult = { ok: true; data: PreparedPayment } | { ok: false; error: string };

/** Best-effort client IP. Behind a proxy/CDN, make sure it sets x-forwarded-for. */
const clientIp = async () => clientIpFromHeaders(await headers());

/**
 * Called when a buyer presses Pay (and on retries). Returns a PaymentIntent
 * client secret for Stripe.js to confirm. The amount is computed server-side.
 */
export async function preparePaymentAction(raw: unknown): Promise<PayActionResult> {
  try {
    const input = prepareInputSchema.parse(raw);
    // Abuse limits: card-testing bots hammer payment endpoints.
    rateLimit(`pay-ip:${await clientIp()}`, 20, 10 * 60_000);
    rateLimit(`pay-session:${input.sessionId}`, 10, 10 * 60_000);
    const visitorId = (await cookies()).get("lumen_vid")?.value ?? "anonymous";
    return { ok: true, data: await preparePayment(input, visitorId) };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Something about this order looks off. Please refresh." };
    if (e instanceof Stripe.errors.StripeError) {
      console.warn("[pay] stripe error", e.code, e.message);
      return { ok: false, error: "We couldn't start the payment. Please try again." };
    }
    console.error("[pay] prepare failed", e);
    return { ok: false, error: "We couldn't start the payment. Please try again." };
  }
}

export type SurveyActionResult = { ok: true } | { ok: false; error: string };

/** Buyer taps an answer on the success screen. One tap, no login. */
export async function answerSurveyAction(raw: unknown): Promise<SurveyActionResult> {
  try {
    const input = surveyInputSchema.parse(raw);
    rateLimit(`survey-ip:${await clientIp()}`, 30, 10 * 60_000);
    const visitorId = (await cookies()).get("lumen_vid")?.value ?? "anonymous";
    await recordSurveyAnswer(input, visitorId);
    return { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "That answer didn't go through." };
    console.error("[survey] failed", e);
    return { ok: false, error: "That answer didn't go through." };
  }
}
