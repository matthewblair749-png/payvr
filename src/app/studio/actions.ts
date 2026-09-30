"use server";

/**
 * Studio server actions. Pattern for every action:
 *   1. authenticate → merchant (row-level scope)
 *   2. rate-limit per merchant
 *   3. validate input with zod
 *   4. call the merchant-scoped DAL
 * Errors come back as { ok: false, error } so the UI can show them inline.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkoutConfigSchema, type CheckoutConfig } from "@/lib/checkout/schema";
import { importBrand, type BrandImportResult } from "@/server/brand-import";
import * as pages from "@/server/dal/checkout-pages";
import { syncProductToStripe } from "@/server/payments/catalog";
import { merchantForAction } from "@/server/dal/session";
import { UserError } from "@/server/errors";
import { LIMITS, rateLimit } from "@/server/rate-limit";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const id = z.string().min(1).max(40);
const target = z.enum(["A", "B"]);

async function run<T>(limit: keyof typeof LIMITS, fn: (merchantId: string) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const merchant = await merchantForAction();
    rateLimit(`${limit}:${merchant.id}`, LIMITS[limit].limit, LIMITS[limit].windowMs);
    return { ok: true, data: await fn(merchant.id) };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error("[studio action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function createPageAction(input: { name?: string; config?: CheckoutConfig }) {
  const res = await run("mutate", async (merchantId) => {
    const name = z.string().trim().min(1).max(60).catch("New checkout").parse(input.name);
    const config = input.config ? checkoutConfigSchema.parse(input.config) : undefined;
    return pages.createPage(merchantId, { name, config });
  });
  if (res.ok) redirect(`/studio/pages/${res.data.id}`);
  return res;
}

export async function saveDraftAction(input: { pageId: string; target: "A" | "B"; config: CheckoutConfig }) {
  return run("saveDraft", async (merchantId) => {
    await pages.saveDraft(merchantId, id.parse(input.pageId), target.parse(input.target), checkoutConfigSchema.parse(input.config));
    return { savedAt: Date.now() };
  });
}

export async function renamePageAction(input: { pageId: string; name: string }) {
  return run("mutate", async (merchantId) => {
    await pages.renamePage(merchantId, id.parse(input.pageId), z.string().trim().min(1, "Give it a name").max(60).parse(input.name));
    revalidatePath("/studio");
    return null;
  });
}

export async function archivePageAction(input: { pageId: string }) {
  const res = await run("mutate", async (merchantId) => {
    await pages.archivePage(merchantId, id.parse(input.pageId));
    return null;
  });
  if (res.ok) {
    revalidatePath("/studio");
    redirect("/studio");
  }
  return res;
}

const productInput = z.object({
  pageId: id,
  name: z.string().trim().min(1, "Product needs a name").max(80),
  description: z.string().trim().max(280),
  priceCents: z.number().int().min(50, "Minimum price is 0.50").max(99_999_99),
  currency: z.enum(["usd", "eur", "gbp", "cad", "aud"]),
});

export async function updateProductAction(input: z.input<typeof productInput>) {
  return run("mutate", async (merchantId) => {
    const { pageId, ...data } = productInput.parse(input);
    const p = await pages.updateProduct(merchantId, pageId, data);
    // Fire-and-forget: never make the merchant wait on (or fail because of) Stripe.
    void syncProductToStripe(p.id);
    return { name: p.name, description: p.description, priceCents: p.priceCents, currency: p.currency };
  });
}

export async function saveVersionAction(input: { pageId: string; note: string }) {
  return run("mutate", async (merchantId) => {
    const v = await pages.saveVersion(merchantId, id.parse(input.pageId), z.string().trim().max(120).parse(input.note ?? ""));
    return { id: v.id, number: v.number, note: v.note, createdAt: v.createdAt.toISOString() };
  });
}

export async function restoreVersionAction(input: { pageId: string; versionId: string }) {
  return run("mutate", (merchantId) => pages.restoreVersion(merchantId, id.parse(input.pageId), id.parse(input.versionId)));
}

export async function publishAction(input: { pageId: string; slug?: string }) {
  return run("mutate", async (merchantId) => {
    const slug = input.slug ? z.string().trim().toLowerCase().max(48).parse(input.slug) : undefined;
    const { slug: finalSlug, version } = await pages.publishPage(merchantId, id.parse(input.pageId), { slug });
    revalidatePath("/studio");
    revalidatePath(`/pay/${finalSlug}`);
    return {
      slug: finalSlug,
      version: { id: version.id, number: version.number, note: version.note, createdAt: version.createdAt.toISOString() },
    };
  });
}

export async function addVariantAction(input: { pageId: string }) {
  return run("mutate", async (merchantId) => {
    const exp = await pages.addVariant(merchantId, id.parse(input.pageId));
    return { experimentId: exp.id, weightB: exp.variants.find((v) => v.key === "B")?.weight ?? 50 };
  });
}

export async function removeVariantAction(input: { pageId: string }) {
  return run("mutate", async (merchantId) => {
    await pages.removeVariant(merchantId, id.parse(input.pageId));
    return null;
  });
}

export async function setSplitAction(input: { pageId: string; weightB: number }) {
  return run("mutate", async (merchantId) => {
    await pages.setSplit(merchantId, id.parse(input.pageId), z.number().min(0).max(100).parse(input.weightB));
    return null;
  });
}

export async function importBrandAction(input: { url: string }): Promise<ActionResult<BrandImportResult>> {
  return run("brandImport", async () => importBrand(z.string().trim().min(3, "Paste a link").max(500).parse(input.url)));
}
