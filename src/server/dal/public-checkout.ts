import "server-only";
import { cache } from "react";
import { assignVariant } from "@/lib/checkout/assign";
import type { CheckoutConfig, CheckoutProduct } from "@/lib/checkout/schema";
import { db } from "../db";
import { parseConfig } from "./checkout-pages";

/**
 * Public, unauthenticated read for /pay/[slug]. Only returns PUBLISHED pages
 * and only the fields a buyer needs — never merchant PII or draft configs.
 */
export const getPublishedCheckout = cache(async (slug: string) => {
  const page = await db.checkoutPage.findFirst({
    where: { slug, status: "PUBLISHED", publishedVersionId: { not: null } },
    select: {
      id: true,
      merchantId: true,
      publishedVersion: { select: { config: true } },
      product: { select: { name: true, description: true, priceCents: true, currency: true, imageUrl: true, active: true, requiresShipping: true } },
      merchant: { select: { stripeAccountId: true, stripeChargesEnabled: true } },
      experiments: {
        where: { status: "RUNNING" },
        take: 1,
        select: { id: true, variants: { select: { id: true, key: true, weight: true, isControl: true, publishedConfig: true, priceCents: true } } },
      },
    },
  });
  if (!page?.publishedVersion || !page.product?.active) return null;
  return page;
});

export type ResolvedCheckout = {
  pageId: string;
  merchantId: string;
  config: CheckoutConfig;
  product: CheckoutProduct;
  variantId: string | null;
  variantKey: string | null;
  acceptsPayments: boolean;
  /** Connected account id (acct_…). Not secret; Stripe Elements needs it for `onBehalfOf`. */
  stripeAccountId: string | null;
};

/** Pick the config this visitor should see (A/B aware). */
export async function resolveCheckout(slug: string, visitorId: string): Promise<ResolvedCheckout | null> {
  const page = await getPublishedCheckout(slug);
  if (!page?.publishedVersion || !page.product) return null;

  let config = parseConfig(page.publishedVersion.config);
  let variantId: string | null = null;
  let variantKey: string | null = null;
  let priceOverride: number | null = null;

  const exp = page.experiments[0];
  if (exp) {
    const v = assignVariant(visitorId, exp.id, exp.variants);
    if (v) {
      variantId = v.id;
      variantKey = v.key;
      if (!v.isControl && v.publishedConfig) config = parseConfig(v.publishedConfig);
      // Price tests: the variant's price replaces the product price everywhere
      // (display AND the server-side PaymentIntent, which uses this same resolver).
      if (v.priceCents != null) priceOverride = v.priceCents;
    }
  }

  return {
    pageId: page.id,
    merchantId: page.merchantId,
    config,
    product: {
      name: page.product.name,
      description: page.product.description,
      priceCents: priceOverride ?? page.product.priceCents,
      currency: page.product.currency.toUpperCase(),
      imageUrl: page.product.imageUrl ?? undefined,
      requiresShipping: page.product.requiresShipping,
    },
    variantId,
    variantKey,
    acceptsPayments: Boolean(page.merchant.stripeAccountId && page.merchant.stripeChargesEnabled),
    stripeAccountId: page.merchant.stripeAccountId,
  };
}
