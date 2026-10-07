"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { toActionError, type ActionResult } from "../errors";
import { LIMITS, rateLimit } from "../rate-limit";
import { workspaceForAction } from "../workspace";

const Input = z.object({
  kind: z.enum(["insight", "opportunity", "recommendation"]),
  key: z.string().min(1).max(80),
  status: z.enum(["OPEN", "DONE", "DISMISSED"]),
});

/** Set an insight/opportunity/recommendation status. Scoped to the caller's company. */
export async function setItemStatus(companyId: string, kind: string, key: string, status: string): Promise<ActionResult> {
  try {
    const ws = await workspaceForAction(companyId);
    rateLimit(`mutate:${ws.user.id}`, LIMITS.mutate);
    const p = Input.parse({ kind, key, status });
    const where = { companyId_key: { companyId: ws.company.id, key: p.key } };
    if (p.kind === "insight") await db.insight.update({ where, data: { status: p.status } });
    else if (p.kind === "opportunity") await db.opportunity.update({ where, data: { status: p.status } });
    else await db.recommendation.update({ where, data: { status: p.status } });
    revalidatePath("/app", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e, "We couldn't update that. Please try again.");
  }
}
