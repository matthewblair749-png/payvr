import "server-only";
import { db } from "../db";
import { getStripe, stripeConfigured } from "../stripe";

/**
 * Mirror a lumen Product into Stripe Products/Prices (on the platform) so
 * payments are traceable in the Stripe dashboard. Prices are immutable in
 * Stripe, so a price change creates a new Price and archives the old one.
 *
 * Checkout amounts are always computed by lumen's pricing module; this sync
 * is for reporting and never blocks saving a product.
 */
export async function syncProductToStripe(productId: string) {
  if (!stripeConfigured()) return;
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return;
  const stripe = getStripe();

  try {
    let stripeProductId = product.stripeProductId;
    if (stripeProductId) {
      await stripe.products.update(stripeProductId, { name: product.name, description: product.description || undefined });
    } else {
      const sp = await stripe.products.create(
        {
          name: product.name,
          description: product.description || undefined,
          metadata: { lumen_product_id: product.id, lumen_merchant_id: product.merchantId },
        },
        { idempotencyKey: `product_${product.id}` },
      );
      stripeProductId = sp.id;
    }

    let stripePriceId = product.stripePriceId;
    const current = stripePriceId ? await stripe.prices.retrieve(stripePriceId) : null;
    if (!current || current.unit_amount !== product.priceCents || current.currency !== product.currency) {
      const price = await stripe.prices.create({ product: stripeProductId, unit_amount: product.priceCents, currency: product.currency });
      if (current) await stripe.prices.update(current.id, { active: false });
      stripePriceId = price.id;
    }

    await db.product.update({ where: { id: product.id }, data: { stripeProductId, stripePriceId } });
  } catch (e) {
    console.warn("[catalog] Stripe product sync failed; will retry on next save", e);
  }
}
