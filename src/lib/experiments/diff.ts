/**
 * Describe what variant B changes compared to the original, in plain words
 * ("Hides the coupon field", "Moves the testimonial to the top", "Charges $39").
 */
import { BLOCK_META, FONTS } from "@/lib/checkout/meta";
import type { CheckoutConfig } from "@/lib/checkout/schema";
import { formatMoney } from "@/lib/utils";

const label = (t: string) => (BLOCK_META[t as keyof typeof BLOCK_META]?.label ?? t).toLowerCase();

export function describeVariantChanges(
  a: CheckoutConfig,
  b: CheckoutConfig,
  price: { basePriceCents: number | null; variantPriceCents: number | null; currency: string },
): string[] {
  const out: string[] = [];
  const visible = (c: CheckoutConfig) => c.blocks.filter((x) => !x.hidden).map((x) => x.type);
  const va = visible(a);
  const vb = visible(b);

  for (const t of va) if (!vb.includes(t)) out.push(`Hides the ${label(t)}`);
  for (const t of vb) if (!va.includes(t)) out.push(`Shows the ${label(t)}`);

  // Order changes among blocks present in both.
  const common = vb.filter((t) => va.includes(t));
  const aOrder = va.filter((t) => common.includes(t));
  if (common.join() !== aOrder.join()) {
    const moved = common.find((t, i) => aOrder[i] !== t);
    if (moved) out.push(common[0] === moved ? `Moves the ${label(moved)} to the top` : `Reorders blocks (${label(moved)} moves up)`);
  }

  const ta = a.theme;
  const tb = b.theme;
  if (ta.accent.toLowerCase() !== tb.accent.toLowerCase()) out.push(`Uses accent color ${tb.accent}`);
  if (ta.font !== tb.font) out.push(`Uses the ${FONTS[tb.font].label} font`);
  if (ta.radius !== tb.radius) out.push(`${tb.radius > ta.radius ? "Rounder" : "Sharper"} corners (${tb.radius}px)`);
  if (ta.mode !== tb.mode) out.push(`${tb.mode === "dark" ? "Dark" : "Light"} mode`);
  if (ta.layout !== tb.layout) out.push(tb.layout === "modal" ? "Opens as a pop-up" : "Opens as a full page");
  if (ta.background.toLowerCase() !== tb.background.toLowerCase()) out.push(`Background ${tb.background}`);

  const payA = a.blocks.find((x) => x.type === "payment");
  const payB = b.blocks.find((x) => x.type === "payment");
  if (payA?.type === "payment" && payB?.type === "payment" && payA.props.buttonLabel !== payB.props.buttonLabel) {
    out.push(`Pay button says “${payB.props.buttonLabel}”`);
  }
  const badges = (c: CheckoutConfig) => {
    const tb = c.blocks.find((x) => x.type === "trustBadges" && !x.hidden);
    return tb?.type === "trustBadges" ? tb.props.items.join(",") : "";
  };
  if (badges(a) !== badges(b) && va.includes("trustBadges") && vb.includes("trustBadges")) out.push("Different trust badges");

  if (price.variantPriceCents != null && price.variantPriceCents !== price.basePriceCents) {
    out.push(`Charges ${formatMoney(price.variantPriceCents, price.currency)}${price.basePriceCents != null ? ` instead of ${formatMoney(price.basePriceCents, price.currency)}` : ""}`);
  }
  return out.length ? out : ["No visible differences"];
}
