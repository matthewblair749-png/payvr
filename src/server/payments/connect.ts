import "server-only";
import type Stripe from "stripe";
import { db } from "../db";
import { UserError } from "../errors";
import { getStripe } from "../stripe";

/**
 * Stripe Connect (Express) for merchants.
 *
 * Money flow: destination charges. The PaymentIntent lives on the lumen
 * platform with `on_behalf_of` + `transfer_data.destination` set to the
 * merchant's account, so the merchant is the settlement merchant (their
 * name on statements, their country's rules) and funds land in their balance.
 * Refunds use `reverse_transfer` to pull the money back from the merchant.
 */

export type ConnectStatus = {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** What the merchant still needs to do, in plain language. */
  requirementsDue: string[];
};

const SUPPORTED_COUNTRIES = new Set(["US", "CA", "GB", "IE", "AU", "NZ", "DE", "FR", "NL", "ES", "IT", "SE", "DK", "NO", "FI", "BE", "AT", "PT", "CH", "SG", "JP"]);

function toStatus(acct: Stripe.Account | null): ConnectStatus {
  return {
    accountId: acct?.id ?? null,
    chargesEnabled: Boolean(acct?.charges_enabled),
    payoutsEnabled: Boolean(acct?.payouts_enabled),
    detailsSubmitted: Boolean(acct?.details_submitted),
    requirementsDue: (acct?.requirements?.currently_due ?? []).slice(0, 6).map(humanizeRequirement),
  };
}

function humanizeRequirement(r: string) {
  if (r.startsWith("external_account")) return "Add a bank account for payouts";
  if (r.includes("tos_acceptance")) return "Accept Stripe's terms";
  if (r.includes("verification")) return "Verify your identity";
  if (r.startsWith("business_profile")) return "Describe your business";
  if (r.startsWith("individual") || r.startsWith("company")) return "Add your personal or business details";
  return r.replace(/[._]/g, " ");
}

/** Persist the flags we care about from a Stripe Account object. */
export async function applyAccountUpdate(acct: Stripe.Account) {
  await db.merchant.updateMany({
    where: { stripeAccountId: acct.id },
    data: {
      stripeChargesEnabled: Boolean(acct.charges_enabled),
      stripePayoutsEnabled: Boolean(acct.payouts_enabled),
      stripeDetailsSubmitted: Boolean(acct.details_submitted),
      ...(acct.country ? { country: acct.country } : {}),
      ...(acct.default_currency ? { defaultCurrency: acct.default_currency } : {}),
    },
  });
}

/** Create the merchant's Express account (once) and return a Stripe-hosted onboarding link. */
export async function createOnboardingLink(merchantId: string, opts: { email?: string | null; country?: string; appUrl: string }) {
  const stripe = getStripe();
  const merchant = await db.merchant.findUniqueOrThrow({ where: { id: merchantId } });

  let accountId = merchant.stripeAccountId;
  if (!accountId) {
    const country = (opts.country ?? merchant.country ?? "US").toUpperCase();
    if (!SUPPORTED_COUNTRIES.has(country)) throw new UserError("That country isn't supported yet.");
    const acct = await stripe.accounts.create(
      {
        type: "express",
        country,
        email: opts.email ?? undefined,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { name: merchant.name, product_description: "Products and services sold through a lumen checkout" },
        metadata: { lumen_merchant_id: merchant.id },
      },
      // Idempotent per merchant, so a double-click can't create two accounts.
      { idempotencyKey: `acct_create_${merchant.id}` },
    );
    accountId = acct.id;
    await db.merchant.update({ where: { id: merchant.id }, data: { stripeAccountId: accountId, country } });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${opts.appUrl}/studio/payments/refresh`,
    return_url: `${opts.appUrl}/studio/payments?onboarding=done`,
    collection_options: { fields: "eventually_due" },
  });
  return link.url;
}

/** Pull fresh status from Stripe (used when returning from onboarding; webhooks keep it current otherwise). */
export async function refreshConnectStatus(merchantId: string): Promise<ConnectStatus> {
  const merchant = await db.merchant.findUniqueOrThrow({ where: { id: merchantId } });
  if (!merchant.stripeAccountId) return toStatus(null);
  const acct = await getStripe().accounts.retrieve(merchant.stripeAccountId);
  await applyAccountUpdate(acct);
  return toStatus(acct);
}

/** One-time login link to the merchant's Stripe Express dashboard. */
export async function expressDashboardLink(merchantId: string) {
  const merchant = await db.merchant.findUniqueOrThrow({ where: { id: merchantId } });
  if (!merchant.stripeAccountId) throw new UserError("Connect Stripe first.");
  const link = await getStripe().accounts.createLoginLink(merchant.stripeAccountId);
  return link.url;
}

/** Status from our database only (no Stripe call) for fast page renders. */
export async function cachedConnectStatus(merchantId: string): Promise<ConnectStatus> {
  const m = await db.merchant.findUniqueOrThrow({ where: { id: merchantId } });
  return {
    accountId: m.stripeAccountId,
    chargesEnabled: m.stripeChargesEnabled,
    payoutsEnabled: m.stripePayoutsEnabled,
    detailsSubmitted: m.stripeDetailsSubmitted,
    requirementsDue: [],
  };
}
