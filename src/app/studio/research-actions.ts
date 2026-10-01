"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { merchantForAction } from "@/server/dal/session";
import { UserError } from "@/server/errors";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { threadForDisplay } from "@/server/research/agent";
import { generateInsights } from "@/server/research/insights";
import { startProposal } from "@/server/research/proposals";
import type { ActionResult } from "./actions";

const id = z.string().min(1).max(40);

async function guarded<T>(fn: (merchantId: string) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const m = await merchantForAction();
    rateLimit(`mutate:${m.id}`, LIMITS.mutate.limit, LIMITS.mutate.windowMs);
    return { ok: true, data: await fn(m.id) };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input" };
    console.error("[research action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** The one click: start a proposed experiment. */
export async function startProposalAction(input: { insightId: string }) {
  return guarded(async (merchantId) => {
    const r = await startProposal(merchantId, id.parse(input.insightId));
    revalidatePath("/studio");
    return r;
  });
}

export async function dismissInsightAction(input: { insightId: string }) {
  return guarded(async (merchantId) => {
    await db.insight.updateMany({ where: { id: id.parse(input.insightId), merchantId }, data: { dismissedAt: new Date() } });
    return null;
  });
}

export async function refreshInsightsAction() {
  return guarded(async (merchantId) => {
    const n = await generateInsights(merchantId);
    revalidatePath("/studio/research");
    return n;
  });
}

export async function loadThreadAction(input: { threadId: string }) {
  return guarded(async (merchantId) => {
    const msgs = await threadForDisplay(merchantId, id.parse(input.threadId));
    if (!msgs) throw new UserError("Conversation not found");
    return msgs;
  });
}
