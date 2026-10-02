import "server-only";
import { db } from "../db";

/**
 * Whose numbers Home shows.
 * - "demo": this merchant *is* lumen's demo shop (all its data is sample data).
 * - "sample": a new merchant with no sales, viewing the demo shop's data
 *   (labelled, read-only, and switchable off) so Home isn't blank on day one.
 * - "first-run": no sales and sample data turned off: the onboarding checklist.
 * - "live": the merchant's own data.
 * Sample data is only ever read from a merchant flagged isSample.
 */
export type HomeMode =
  | { kind: "demo" | "sample" | "live"; dataMerchantId: string; currency: string; sampleName: string | null }
  | { kind: "first-run"; dataMerchantId: null; currency: string; sampleName: null };

const PAID = ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"] as const;

export async function homeMode(merchant: { id: string; isSample: boolean; showSample: boolean; defaultCurrency: string }): Promise<HomeMode> {
  if (merchant.isSample) return { kind: "demo", dataMerchantId: merchant.id, currency: merchant.defaultCurrency, sampleName: null };
  const hasSales = await db.order.findFirst({ where: { merchantId: merchant.id, status: { in: [...PAID] } }, select: { id: true } });
  if (hasSales) return { kind: "live", dataMerchantId: merchant.id, currency: merchant.defaultCurrency, sampleName: null };
  if (merchant.showSample) {
    const sample = await db.merchant.findFirst({ where: { isSample: true }, select: { id: true, name: true, defaultCurrency: true } });
    if (sample) return { kind: "sample", dataMerchantId: sample.id, currency: sample.defaultCurrency, sampleName: sample.name };
  }
  return { kind: "first-run", dataMerchantId: null, currency: merchant.defaultCurrency, sampleName: null };
}

/** Writes (starting tests, drafting proposals) only ever touch the merchant's own shop. */
export const canWrite = (mode: HomeMode) => mode.kind === "live" || mode.kind === "demo";

/** Progress for the first-run checklist, from real data. */
export async function firstRunState(merchantId: string, stripeReady: boolean) {
  const [page, visit] = await Promise.all([
    db.checkoutPage.findFirst({ where: { merchantId, status: "PUBLISHED" }, orderBy: { publishedAt: "asc" }, select: { name: true, slug: true } }),
    db.checkoutEvent.findFirst({ where: { merchantId, type: "VIEW" }, select: { id: true } }),
  ]);
  return { published: page, stripeReady, visited: Boolean(visit) };
}
