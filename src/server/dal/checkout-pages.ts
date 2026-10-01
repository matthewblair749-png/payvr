import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { DEMO_CONFIG } from "@/lib/checkout/defaults";
import { checkoutConfigSchema, type CheckoutConfig } from "@/lib/checkout/schema";
import { slugify } from "@/lib/utils";
import { db } from "../db";
import { hostLogo } from "../assets";
import { UserError } from "../errors";

/**
 * Checkout page data access. EVERY function takes `merchantId` and filters on
 * it, so a merchant can never read or mutate another merchant's rows even if
 * they guess an id. Configs are re-validated before they're written.
 */

export class NotFoundError extends UserError {
  constructor(what = "Not found") {
    super(what);
    this.name = "NotFoundError";
  }
}

const RESERVED_SLUGS = new Set(["new", "admin", "api", "app", "studio", "login", "pay", "lumen", "test", "demo-internal"]);
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

/** Parse a stored JSON config; falls back to the demo if it's somehow invalid. */
export function parseConfig(json: unknown): CheckoutConfig {
  const parsed = checkoutConfigSchema.safeParse(json);
  return parsed.success ? parsed.data : DEMO_CONFIG;
}

const asJson = (c: CheckoutConfig) => c as unknown as Prisma.InputJsonValue;

/** Find a free, valid slug based on `base`. */
export async function uniqueSlug(base: string, excludePageId?: string) {
  let root = slugify(base, "checkout");
  if (root.length < 3) root = `${root}-shop`;
  if (RESERVED_SLUGS.has(root)) root = `${root}-shop`;
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root.slice(0, 42)}-${i + 1}`;
    const taken = await db.checkoutPage.findFirst({
      where: { slug: candidate, ...(excludePageId ? { NOT: { id: excludePageId } } : {}) },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${root.slice(0, 36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listPages(merchantId: string) {
  return db.checkoutPage.findMany({
    where: { merchantId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      product: true,
      experiments: { where: { status: "RUNNING" }, select: { id: true } },
      _count: { select: { versions: true } },
    },
  });
}

/** Everything the Studio editor needs for one page. */
export async function getPageForEditor(merchantId: string, pageId: string) {
  const page = await db.checkoutPage.findFirst({
    where: { id: pageId, merchantId },
    include: {
      product: true,
      versions: { orderBy: { number: "desc" }, take: 50 },
      experiments: {
        where: { status: { in: ["DRAFT", "RUNNING"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { variants: { orderBy: { key: "asc" } } },
      },
    },
  });
  if (!page) throw new NotFoundError("Checkout page not found");
  return page;
}

export async function createPage(
  merchantId: string,
  input: { name: string; config?: CheckoutConfig; currency?: string },
) {
  const config = input.config ?? DEMO_CONFIG;
  const slug = await uniqueSlug(config.brand.name || input.name);
  return db.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        merchantId,
        name: "Your product",
        description: "Tell buyers what they're getting.",
        priceCents: 2900,
        currency: input.currency ?? "usd",
      },
    });
    return tx.checkoutPage.create({
      data: { merchantId, productId: product.id, name: input.name, slug, draftConfig: asJson(config) },
    });
  });
}

/** Ownership check that returns the page id or throws. */
async function ownPage(merchantId: string, pageId: string) {
  const page = await db.checkoutPage.findFirst({ where: { id: pageId, merchantId }, select: { id: true } });
  if (!page) throw new NotFoundError("Checkout page not found");
  return page.id;
}

/** Autosave target: the page draft (variant "A") or a non-control variant. */
export async function saveDraft(merchantId: string, pageId: string, target: string, config: CheckoutConfig) {
  await ownPage(merchantId, pageId);
  const valid = checkoutConfigSchema.parse(config);
  if (target === "A") {
    await db.checkoutPage.update({ where: { id: pageId }, data: { draftConfig: asJson(valid) } });
    return;
  }
  const variant = await db.variant.findFirst({
    where: { key: target, isControl: false, experiment: { checkoutPageId: pageId, merchantId, status: { in: ["DRAFT", "RUNNING"] } } },
    select: { id: true },
  });
  if (!variant) throw new NotFoundError("Variant not found");
  await db.variant.update({ where: { id: variant.id }, data: { config: asJson(valid) } });
}

export async function renamePage(merchantId: string, pageId: string, name: string) {
  await ownPage(merchantId, pageId);
  return db.checkoutPage.update({ where: { id: pageId }, data: { name } });
}

export async function archivePage(merchantId: string, pageId: string) {
  await ownPage(merchantId, pageId);
  return db.checkoutPage.update({ where: { id: pageId }, data: { status: "ARCHIVED" } });
}

export async function updateProduct(
  merchantId: string,
  pageId: string,
  data: { name: string; description: string; priceCents: number; currency: string },
) {
  const page = await db.checkoutPage.findFirst({ where: { id: pageId, merchantId }, select: { productId: true } });
  if (!page) throw new NotFoundError("Checkout page not found");
  if (page.productId) {
    // Phase 3: price changes also create a new Stripe Price (prices are immutable in Stripe).
    return db.product.update({ where: { id: page.productId, merchantId }, data });
  }
  const product = await db.product.create({ data: { merchantId, ...data } });
  await db.checkoutPage.update({ where: { id: pageId }, data: { productId: product.id } });
  return product;
}

/** Snapshot the current draft as a new immutable version. */
export async function saveVersion(merchantId: string, pageId: string, note: string) {
  const page = await db.checkoutPage.findFirst({ where: { id: pageId, merchantId } });
  if (!page) throw new NotFoundError("Checkout page not found");
  return createVersion(pageId, parseConfig(page.draftConfig), note);
}

async function createVersion(pageId: string, config: CheckoutConfig, note: string) {
  // Retry on the (rare) race where two saves grab the same number.
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await db.checkoutPageVersion.findFirst({
      where: { checkoutPageId: pageId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    try {
      return await db.checkoutPageVersion.create({
        data: { checkoutPageId: pageId, number: (last?.number ?? 0) + 1, config: asJson(config), note },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new UserError("Could not save version, please retry");
}

/** Copy a version back into the draft. */
export async function restoreVersion(merchantId: string, pageId: string, versionId: string) {
  const version = await db.checkoutPageVersion.findFirst({
    where: { id: versionId, checkoutPageId: pageId, checkoutPage: { merchantId } },
  });
  if (!version) throw new NotFoundError("Version not found");
  const config = parseConfig(version.config);
  await db.checkoutPage.update({ where: { id: pageId }, data: { draftConfig: asJson(config) } });
  return config;
}

/**
 * Publish: snapshot the draft (A) as a version and point the page at it.
 * If a B variant exists, its config is snapshotted too and the experiment
 * starts RUNNING, so buyers are split between A and B from now on.
 */
export async function publishPage(merchantId: string, pageId: string, opts: { slug?: string; note?: string } = {}) {
  const page = await db.checkoutPage.findFirst({
    where: { id: pageId, merchantId },
    include: { experiments: { where: { status: { in: ["DRAFT", "RUNNING"] } }, include: { variants: true } } },
  });
  if (!page) throw new NotFoundError("Checkout page not found");

  let slug = page.slug;
  if (opts.slug && opts.slug !== page.slug) {
    if (!SLUG_RE.test(opts.slug) || RESERVED_SLUGS.has(opts.slug)) throw new UserError("That URL isn't allowed. Use 3–48 lowercase letters, numbers and dashes.");
    const taken = await db.checkoutPage.findFirst({ where: { slug: opts.slug, NOT: { id: pageId } }, select: { id: true } });
    if (taken) throw new UserError("That URL is taken");
    slug = opts.slug;
  }

  // Live checkouts only load same-origin logos (see server/assets.ts).
  const draft = await withHostedLogo(merchantId, parseConfig(page.draftConfig));
  const version = await createVersion(pageId, draft, opts.note || "Published");
  const variantConfigs = new Map<string, CheckoutConfig>();
  for (const exp of page.experiments) {
    for (const v of exp.variants) {
      if (!v.isControl && v.config) variantConfigs.set(v.id, await withHostedLogo(merchantId, parseConfig(v.config)));
    }
  }
  await db.$transaction(async (tx) => {
    await tx.checkoutPage.update({
      where: { id: pageId },
      data: { slug, status: "PUBLISHED", publishedVersionId: version.id, publishedAt: new Date(), draftConfig: asJson(draft) },
    });
    for (const exp of page.experiments) {
      for (const v of exp.variants) {
        const config = variantConfigs.get(v.id);
        if (config) await tx.variant.update({ where: { id: v.id }, data: { config: asJson(config), publishedConfig: asJson(config) } });
      }
      if (exp.status === "DRAFT") {
        await tx.experiment.update({ where: { id: exp.id }, data: { status: "RUNNING", startedAt: new Date() } });
      }
    }
  });
  return { slug, version };
}

/**
 * Copy a remote logo into lumen: a live checkout never hot-links a third-party
 * host. If the copy fails, publishing stops with a fixable message rather than
 * silently going live without the logo.
 */
async function withHostedLogo(merchantId: string, config: CheckoutConfig): Promise<CheckoutConfig> {
  const logoUrl = config.brand.logoUrl;
  if (!logoUrl) return config;
  try {
    const hosted = await hostLogo(merchantId, logoUrl);
    return hosted === logoUrl ? config : { ...config, brand: { ...config.brand, logoUrl: hosted } };
  } catch (e) {
    const why = e instanceof UserError ? e.message : "it couldn't be downloaded";
    throw new UserError(`Couldn't copy your logo into lumen (${why}). Try a different logo link or remove it, then publish.`);
  }
}

/** Create a draft A/B experiment with B starting as a copy of the current draft. */
export async function addVariant(merchantId: string, pageId: string) {
  const page = await db.checkoutPage.findFirst({
    where: { id: pageId, merchantId },
    include: { experiments: { where: { status: { in: ["DRAFT", "RUNNING"] } }, select: { id: true } } },
  });
  if (!page) throw new NotFoundError("Checkout page not found");
  if (page.experiments.length) throw new UserError("This checkout already has a variant");
  return db.experiment.create({
    data: {
      merchantId,
      checkoutPageId: pageId,
      name: `${page.name}: A vs B`,
      variants: {
        create: [
          { key: "A", name: "Original", isControl: true, weight: 50 },
          { key: "B", name: "Variant B", isControl: false, weight: 50, config: page.draftConfig as Prisma.InputJsonValue },
        ],
      },
    },
    include: { variants: { orderBy: { key: "asc" } } },
  });
}

/** Stop the active experiment. Buyers go back to seeing only A. */
export async function removeVariant(merchantId: string, pageId: string) {
  await ownPage(merchantId, pageId);
  await db.experiment.updateMany({
    where: { merchantId, checkoutPageId: pageId, status: { in: ["DRAFT", "RUNNING"] } },
    data: { status: "STOPPED", endedAt: new Date() },
  });
}

export async function setSplit(merchantId: string, pageId: string, weightB: number) {
  const exp = await db.experiment.findFirst({
    where: { merchantId, checkoutPageId: pageId, status: { in: ["DRAFT", "RUNNING"] } },
    include: { variants: true },
  });
  if (!exp) throw new NotFoundError("No active experiment");
  const b = Math.max(0, Math.min(100, Math.round(weightB)));
  await db.$transaction(
    exp.variants.map((v) => db.variant.update({ where: { id: v.id }, data: { weight: v.isControl ? 100 - b : b } })),
  );
}
