import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { defaultBlock } from "@/lib/checkout/defaults";
import { BLOCK_META, BLOCK_TYPES, FONT_KEYS } from "@/lib/checkout/meta";
import { checkoutConfigSchema, type CheckoutConfig } from "@/lib/checkout/schema";
import { formatMoney } from "@/lib/utils";
import { parseConfig } from "../dal/checkout-pages";
import { db } from "../db";
import { UserError } from "../errors";

/**
 * Experiment proposals: a small, closed vocabulary of changes that variant B
 * can make. Proposals come from the Research Assistant or the insight engine,
 * are stored server-side (Insight rows), and only a merchant click starts
 * them. Applying a change always re-validates the full checkout config.
 */

const blockType = z.enum(BLOCK_TYPES.filter((t) => t !== "payment") as [string, ...string[]]);

export const proposalChangeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("hide_block"), block_type: blockType }),
  z.object({ op: z.literal("show_block"), block_type: blockType }),
  z.object({ op: z.literal("move_block"), block_type: blockType, position: z.enum(["top", "before_payment", "bottom"]) }),
  z.object({ op: z.literal("set_price"), price_cents: z.number().int().min(50).max(1_000_000) }),
  z.object({
    op: z.literal("set_theme"),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    radius: z.number().int().min(0).max(28).optional(),
    font: z.enum(FONT_KEYS).optional(),
    mode: z.enum(["light", "dark"]).optional(),
    layout: z.enum(["page", "modal"]).optional(),
  }),
  z.object({ op: z.literal("set_button_label"), label: z.string().trim().min(1).max(30) }),
  z.object({ op: z.literal("set_trust_badges"), items: z.array(z.enum(["secure", "refund", "support", "shipping"])).min(1).max(4) }),
]);
export type ProposalChange = z.infer<typeof proposalChangeSchema>;

export const proposalSchema = z.object({
  checkoutId: z.string(),
  title: z.string().max(80),
  hypothesis: z.string().max(300),
  metric: z.enum(["conversion", "revenue_per_visit"]),
  changes: z.array(proposalChangeSchema).min(1).max(3),
  source: z.enum(["assistant", "insight"]),
  startedExperimentId: z.string().optional(),
});
export type Proposal = z.infer<typeof proposalSchema>;

const label = (t: string) => BLOCK_META[t as keyof typeof BLOCK_META]?.label ?? t;

export function describeChange(c: ProposalChange, currency = "USD"): string {
  switch (c.op) {
    case "hide_block":
      return `Hide the ${label(c.block_type).toLowerCase()}`;
    case "show_block":
      return `Show the ${label(c.block_type).toLowerCase()}`;
    case "move_block":
      return `Move the ${label(c.block_type).toLowerCase()} ${c.position === "top" ? "to the top" : c.position === "bottom" ? "to the bottom" : "just above payment"}`;
    case "set_price":
      return `Charge ${formatMoney(c.price_cents, currency)}`;
    case "set_theme":
      return `Change the look (${Object.entries(c).filter(([k]) => k !== "op").map(([k, v]) => `${k}: ${v}`).join(", ")})`;
    case "set_button_label":
      return `Pay button says “${c.label}”`;
    case "set_trust_badges":
      return `Trust badges: ${c.items.join(", ")}`;
  }
}

/** Apply changes to a config. Returns variant B's config and optional price override. */
export function applyChanges(base: CheckoutConfig, changes: ProposalChange[]): { config: CheckoutConfig; priceCents: number | null } {
  let config: CheckoutConfig = structuredClone(base);
  let priceCents: number | null = null;

  const indexOf = (t: string) => config.blocks.findIndex((b) => b.type === t);
  const ensure = (t: string) => {
    let i = indexOf(t);
    if (i === -1) {
      const pay = indexOf("payment");
      config.blocks.splice(pay, 0, defaultBlock(t as (typeof BLOCK_TYPES)[number], `${t}-b`));
      i = indexOf(t);
    }
    return i;
  };

  for (const c of changes) {
    switch (c.op) {
      case "hide_block": {
        const i = indexOf(c.block_type);
        if (i === -1) throw new UserError(`This checkout has no ${label(c.block_type).toLowerCase()} to hide.`);
        config.blocks[i] = { ...config.blocks[i], hidden: true };
        break;
      }
      case "show_block": {
        const i = ensure(c.block_type);
        config.blocks[i] = { ...config.blocks[i], hidden: false };
        break;
      }
      case "move_block": {
        const i = ensure(c.block_type);
        const [b] = config.blocks.splice(i, 1);
        const target = c.position === "top" ? 0 : c.position === "bottom" ? config.blocks.length : indexOf("payment");
        config.blocks.splice(target, 0, { ...b, hidden: false });
        break;
      }
      case "set_price":
        priceCents = c.price_cents;
        break;
      case "set_theme": {
        const { op: _op, ...patch } = c;
        void _op;
        config = { ...config, theme: { ...config.theme, ...patch } };
        break;
      }
      case "set_button_label": {
        const i = indexOf("payment");
        const b = config.blocks[i];
        if (b.type === "payment") config.blocks[i] = { ...b, props: { ...b.props, buttonLabel: c.label } };
        break;
      }
      case "set_trust_badges": {
        const i = ensure("trustBadges");
        const b = config.blocks[i];
        if (b.type === "trustBadges") config.blocks[i] = { ...b, hidden: false, props: { items: c.items } };
        break;
      }
    }
  }
  const parsed = checkoutConfigSchema.safeParse(config);
  if (!parsed.success) throw new UserError("That change would make an invalid checkout.");
  return { config: parsed.data, priceCents };
}

export async function createProposal(merchantId: string, p: Omit<Proposal, "startedExperimentId">) {
  const page = await db.checkoutPage.findFirst({
    where: { id: p.checkoutId, merchantId },
    include: { publishedVersion: true, product: true },
  });
  if (!page) throw new UserError("Unknown checkout id. Call list_checkouts first.");
  if (!page.publishedVersion) throw new UserError("That checkout isn't published yet, so it can't be A/B tested.");
  // Dry run so we never store a proposal that can't be applied.
  applyChanges(parseConfig(page.publishedVersion.config), p.changes);
  return db.insight.create({
    data: {
      merchantId,
      kind: p.source === "assistant" ? "assistant_proposal" : "insight_proposal",
      title: p.title,
      body: p.hypothesis,
      data: { proposal: p } as unknown as Prisma.InputJsonValue,
    },
  });
}

export type ProposalView = {
  insightId: string;
  title: string;
  hypothesis: string;
  checkoutId: string;
  checkoutName: string;
  metric: Proposal["metric"];
  changes: string[];
  startedExperimentId: string | null;
};

/** Read a stored proposal (merchant-scoped) in a UI-friendly shape. */
export async function getProposal(merchantId: string, insightId: string): Promise<ProposalView | null> {
  const insight = await db.insight.findFirst({ where: { id: insightId, merchantId } });
  const parsed = proposalSchema.safeParse((insight?.data as { proposal?: unknown } | null)?.proposal);
  if (!insight || !parsed.success) return null;
  const page = await db.checkoutPage.findFirst({ where: { id: parsed.data.checkoutId, merchantId }, include: { product: true } });
  const currency = (page?.product?.currency ?? "usd").toUpperCase();
  return {
    insightId: insight.id,
    title: parsed.data.title,
    hypothesis: parsed.data.hypothesis,
    checkoutId: parsed.data.checkoutId,
    checkoutName: page?.name ?? "Checkout",
    metric: parsed.data.metric,
    changes: parsed.data.changes.map((c) => describeChange(c, currency)),
    startedExperimentId: parsed.data.startedExperimentId ?? null,
  };
}

/** The one-click part: turn a stored proposal into a running 50/50 A/B test. */
export async function startProposal(merchantId: string, insightId: string) {
  const insight = await db.insight.findFirst({ where: { id: insightId, merchantId } });
  const parsed = proposalSchema.safeParse((insight?.data as { proposal?: unknown } | null)?.proposal);
  if (!insight || !parsed.success) throw new UserError("That proposal no longer exists.");
  const p = parsed.data;
  if (p.startedExperimentId) return { experimentId: p.startedExperimentId, alreadyStarted: true };

  const page = await db.checkoutPage.findFirst({
    where: { id: p.checkoutId, merchantId },
    include: { publishedVersion: true, experiments: { where: { status: { in: ["DRAFT", "RUNNING"] } }, select: { id: true } } },
  });
  if (!page?.publishedVersion) throw new UserError("Publish the checkout before testing it.");
  if (page.experiments.length) throw new UserError("This checkout already has a test running. Stop it first, then start this one.");

  const { config, priceCents } = applyChanges(parseConfig(page.publishedVersion.config), p.changes);
  const json = config as unknown as Prisma.InputJsonValue;

  const exp = await db.$transaction(async (tx) => {
    const e = await tx.experiment.create({
      data: {
        merchantId,
        checkoutPageId: page.id,
        name: p.title,
        hypothesis: p.hypothesis,
        primaryMetric: p.metric,
        status: "RUNNING",
        startedAt: new Date(),
        sourceInsightId: insight.id,
        variants: {
          create: [
            { key: "A", name: "Current checkout", isControl: true, weight: 50 },
            { key: "B", name: p.title, isControl: false, weight: 50, config: json, publishedConfig: json, priceCents },
          ],
        },
      },
    });
    await tx.insight.update({
      where: { id: insight.id },
      data: { data: { proposal: { ...p, startedExperimentId: e.id } } as unknown as Prisma.InputJsonValue },
    });
    return e;
  });
  return { experimentId: exp.id, alreadyStarted: false };
}
