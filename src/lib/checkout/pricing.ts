/**
 * Checkout pricing — the ONE implementation of "what does this cost".
 *
 * The browser uses it to show totals; the server runs the exact same function
 * against the *published* config and the product's saved price when it creates
 * the PaymentIntent. Nothing price-related is ever taken from the client except
 * the buyer's choices (add-on on/off, tip %, coupon code), which are clamped
 * and validated here.
 */
import type { CheckoutConfig, CheckoutProduct } from "./schema";

export type BuyerSelections = {
  upsellAdded: boolean;
  tipPercent: number;
  couponCode: string | null;
  payIn4: boolean;
};

export const EMPTY_SELECTIONS: BuyerSelections = { upsellAdded: false, tipPercent: 0, couponCode: null, payIn4: false };

export type PriceLine = { label: string; cents: number; kind: "upsell" | "discount" | "tip" };

export type Totals = {
  productCents: number;
  upsellCents: number;
  subtotalCents: number;
  discountCents: number;
  tipCents: number;
  totalCents: number;
  /** Normalized coupon that actually applied, or null. */
  couponApplied: { code: string; percentOff: number } | null;
  /** Tip percent after clamping to the block's max / 5% steps. */
  tipPercent: number;
  payIn4: boolean;
  lines: PriceLine[];
};

/** Look up a coupon code on the checkout's (visible) coupon block. */
export function findCoupon(config: CheckoutConfig, code: string | null | undefined) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  for (const b of config.blocks) {
    if (b.type !== "coupon" || b.hidden) continue;
    const hit = b.props.codes.find((c) => c.code === normalized);
    if (hit) return hit;
  }
  return null;
}

export function computeTotals(config: CheckoutConfig, product: CheckoutProduct, sel: BuyerSelections): Totals {
  const visible = config.blocks.filter((b) => !b.hidden);
  const upsell = visible.find((b) => b.type === "upsell");
  const tipBlock = visible.find((b) => b.type === "tipSlider");
  const hasPayIn4 = visible.some((b) => b.type === "payIn4");

  const upsellCents = upsell?.type === "upsell" && sel.upsellAdded ? upsell.props.priceCents : 0;
  const subtotalCents = product.priceCents + upsellCents;

  const couponApplied = findCoupon(config, sel.couponCode);
  const discountCents = couponApplied ? Math.round((subtotalCents * couponApplied.percentOff) / 100) : 0;

  const maxTip = tipBlock?.type === "tipSlider" ? tipBlock.props.maxPercent : 0;
  const rawTip = Number.isFinite(sel.tipPercent) ? sel.tipPercent : 0;
  const tipPercent = Math.max(0, Math.min(maxTip, Math.round(rawTip / 5) * 5));
  const tipCents = Math.round(((subtotalCents - discountCents) * tipPercent) / 100);

  const totalCents = subtotalCents - discountCents + tipCents;

  const lines: PriceLine[] = [];
  if (upsellCents && upsell?.type === "upsell") lines.push({ label: upsell.props.title, cents: upsellCents, kind: "upsell" });
  if (discountCents && couponApplied) lines.push({ label: `Code ${couponApplied.code}`, cents: -discountCents, kind: "discount" });
  if (tipCents) lines.push({ label: "Tip", cents: tipCents, kind: "tip" });

  return {
    productCents: product.priceCents,
    upsellCents,
    subtotalCents,
    discountCents,
    tipCents,
    totalCents,
    couponApplied,
    tipPercent,
    payIn4: hasPayIn4 && sel.payIn4,
    lines,
  };
}

/** Stripe's minimum charge is roughly 50 units of the smallest major currency unit. */
export const MIN_CHARGE_CENTS = 50;
