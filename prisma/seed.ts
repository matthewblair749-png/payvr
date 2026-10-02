/**
 * Demo data so the Studio (and later the dashboard) looks alive on first run.
 *
 *   npm run db:seed
 *
 * Idempotent: removes and recreates the demo merchant (demo@lumen.test).
 * Sign in with that address; in local dev the magic link is shown on screen.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { DEMO_CONFIG, defaultBlock } from "../src/lib/checkout/defaults";
import { checkoutConfigSchema, type CheckoutConfig } from "../src/lib/checkout/schema";
import { seedAnalytics } from "./seed-analytics";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const DEMO_EMAIL = "demo@lumen.test";

const json = (c: CheckoutConfig) => checkoutConfigSchema.parse(c) as unknown as Prisma.InputJsonValue;

const mugA: CheckoutConfig = DEMO_CONFIG;
const mugB: CheckoutConfig = {
  ...DEMO_CONFIG,
  theme: { ...DEMO_CONFIG.theme, accent: "#1F7A4D", background: "#E3EFE6", radius: 24 },
  // Hypothesis: social proof above the fold beats urgency.
  blocks: [
    defaultBlock("orderSummary", "summary"),
    defaultBlock("testimonial", "testimonial"),
    defaultBlock("upsell", "upsell"),
    defaultBlock("coupon", "coupon"),
    defaultBlock("payment", "payment"),
    defaultBlock("trustBadges", "trust"),
  ],
};

const workshop: CheckoutConfig = {
  schemaVersion: 1,
  brand: { name: "Kiln & Co." },
  theme: { mode: "light", accent: "#B83A12", background: "#F6EEE3", font: "fraunces", radius: 6, layout: "page" },
  survey: { enabled: true, question: "heard_about" },
  blocks: [
    defaultBlock("orderSummary", "summary"),
    {
      ...defaultBlock("testimonial", "t1"),
      props: { quote: "Three hours flew by. I left with two bowls and a new obsession.", author: "Marcus L.", detail: "Saturday class", rating: 5 },
    } as CheckoutConfig["blocks"][number],
    { ...defaultBlock("countdown", "seats"), props: { label: "Seats held for", minutes: 15 } } as CheckoutConfig["blocks"][number],
    defaultBlock("payIn4", "payin4"),
    defaultBlock("payment", "payment"),
    defaultBlock("trustBadges", "trust"),
  ],
};

const giftCard: CheckoutConfig = {
  schemaVersion: 1,
  brand: { name: "Kiln & Co." },
  theme: { mode: "dark", accent: "#FFB100", background: "#0E0E10", font: "sora", radius: 18, layout: "modal" },
  survey: { enabled: true, question: "nearly_stopped" },
  blocks: [
    defaultBlock("orderSummary", "summary"),
    { ...defaultBlock("tipSlider", "tip"), props: { label: "Add a little extra to the gift", maxPercent: 50 } } as CheckoutConfig["blocks"][number],
    defaultBlock("payment", "payment"),
  ],
};

async function main() {
  await db.user.deleteMany({ where: { email: DEMO_EMAIL } }); // cascades to merchant + everything

  const user = await db.user.create({ data: { email: DEMO_EMAIL, name: "Kiln & Co.", emailVerified: new Date() } });
  const merchant = await db.merchant.create({ data: { userId: user.id, name: "Kiln & Co.", country: "US", isSample: true } });

  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

  async function page(opts: {
    name: string;
    slug: string;
    product: { name: string; description: string; priceCents: number; requiresShipping?: boolean };
    versions: { config: CheckoutConfig; note: string; daysAgo: number }[];
    draft: CheckoutConfig;
    publish: boolean;
  }) {
    const product = await db.product.create({ data: { merchantId: merchant.id, currency: "usd", ...opts.product } });
    const p = await db.checkoutPage.create({
      data: {
        merchantId: merchant.id,
        productId: product.id,
        name: opts.name,
        slug: opts.slug,
        draftConfig: json(opts.draft),
        createdAt: daysAgo(opts.versions[0]?.daysAgo ?? 1),
      },
    });
    let last = null;
    for (const [i, v] of opts.versions.entries()) {
      last = await db.checkoutPageVersion.create({
        data: { checkoutPageId: p.id, number: i + 1, config: json(v.config), note: v.note, createdAt: daysAgo(v.daysAgo) },
      });
    }
    if (opts.publish && last) {
      await db.checkoutPage.update({
        where: { id: p.id },
        data: { status: "PUBLISHED", publishedVersionId: last.id, publishedAt: last.createdAt },
      });
    }
    return p;
  }

  // Slugs are globally unique; clear any leftovers from a previous seed.
  await db.checkoutPage.deleteMany({ where: { slug: { in: ["kiln-mugs", "kiln-workshop", "kiln-gift-card"] } } });

  const mugs = await page({
    name: "Mug set launch",
    slug: "kiln-mugs",
    // $52 since the price test above was shipped (it was $48 before).
    product: { name: "Speckled mug set", description: "Two wheel-thrown stoneware mugs, 12oz, oatmeal glaze.", priceCents: 5200, requiresShipping: true },
    versions: [
      { config: { ...mugA, theme: { ...mugA.theme, radius: 8 } }, note: "First launch", daysAgo: 21 },
      { config: { ...mugA, theme: { ...mugA.theme, radius: 12 } }, note: "Softer corners", daysAgo: 14 },
      { config: mugA, note: "Added tip slider + pay in 4", daysAgo: 6 },
    ],
    draft: mugA,
    publish: true,
  });

  // An earlier, finished price test: $52 earned more per visit than $48 without
  // costing sales, so it was shipped (the mug set has cost $52 since).
  const pastTest = await db.experiment.create({
    include: { variants: { orderBy: { key: "asc" } } },
    data: {
      merchantId: merchant.id,
      checkoutPageId: mugs.id,
      name: "Try $52 instead of $48",
      hypothesis: "Price is the reason buyers mention least. A $4 increase should earn more per visit without losing many sales.",
      primaryMetric: "revenue_per_visit",
      status: "RUNNING", // finished below, once we know the winner id
      startedAt: daysAgo(70),
      variants: {
        create: [
          { key: "A", name: "$48 (original)", isControl: true, weight: 50 },
          { key: "B", name: "$52", isControl: false, weight: 50, config: json(mugA), publishedConfig: json(mugA), priceCents: 5200 },
        ],
      },
    },
  });
  await db.experiment.update({
    where: { id: pastTest.id },
    data: { status: "COMPLETED", endedAt: daysAgo(22), winnerVariantId: pastTest.variants[1].id },
  });

  const experiment = await db.experiment.create({
    include: { variants: { orderBy: { key: "asc" } } },
    data: {
      merchantId: merchant.id,
      checkoutPageId: mugs.id,
      name: "Social proof first",
      hypothesis: "Leading with a testimonial instead of a countdown will lift conversion.",
      status: "RUNNING",
      startedAt: daysAgo(21),
      variants: {
        create: [
          { key: "A", name: "Original", isControl: true, weight: 50 },
          { key: "B", name: "Social proof first", isControl: false, weight: 50, config: json(mugB), publishedConfig: json(mugB) },
        ],
      },
    },
  });

  const workshopPage = await page({
    name: "Glaze workshop",
    slug: "kiln-workshop",
    product: { name: "Saturday glaze workshop", description: "3 hours at the wheel, clay and firing included.", priceCents: 8500 },
    versions: [{ config: workshop, note: "Workshop page", daysAgo: 10 }],
    draft: workshop,
    publish: true,
  });

  await page({
    name: "Holiday gift card",
    slug: "kiln-gift-card",
    product: { name: "Kiln & Co. gift card", description: "Good for anything in the shop or a class.", priceCents: 5000 },
    versions: [],
    draft: giftCard,
    publish: false,
  });

  const stats = await seedAnalytics(db, merchant.id, [
    {
      id: mugs.id,
      productId: mugs.productId!,
      priceCents: 5200,
      priceBefore: { daysAgo: 22, priceCents: 4800 },
      upsellCents: 1200,
      shipping: true,
      traffic: 1,
      blocks: mugA.blocks.filter((b) => !b.hidden).map((b) => b.type),
      experiments: [
        // Buyers didn't flinch at $52: same conversion, more per sale.
        { fromDaysAgo: 70, toDaysAgo: 22, variants: pastTest.variants.map((v) => ({ id: v.id, key: v.key, lift: 1, priceCents: v.key === "B" ? 5200 : 4800 })) },
        { fromDaysAgo: 21, toDaysAgo: 0, variants: experiment.variants.map((v) => ({ id: v.id, key: v.key, lift: v.key === "B" ? 1.145 : 1 })) },
      ],
    },
    {
      id: workshopPage.id,
      productId: workshopPage.productId!,
      priceCents: 8500,
      upsellCents: 0,
      traffic: 0.45,
      blocks: workshop.blocks.filter((b) => !b.hidden).map((b) => b.type),
      experiments: [],
    },
  ]);

  console.log(`Seeded demo merchant ${DEMO_EMAIL} with 3 checkouts (2 live), 1 A/B test running and 1 finished.`);
  console.log(
    `  + ${stats.events.toLocaleString()} events, ${stats.orders.toLocaleString()} orders, ${stats.surveys.toLocaleString()} survey answers (decline spike on ${stats.spikeDay}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
