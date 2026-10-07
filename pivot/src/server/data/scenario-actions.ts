"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { simulate, SCENARIOS } from "@/lib/engine/simulate";
import type { ScenarioKind, ScenarioResult } from "@/lib/engine/types";
import { Prisma } from "@/generated/prisma/client";
import { getAnalysis } from "../analysis/get";
import { requireFeature } from "../billing/entitlements";
import { db } from "../db";
import { toActionError, UserError, type ActionResult } from "../errors";
import { LIMITS, rateLimit } from "../rate-limit";
import { workspaceForAction } from "../workspace";

export interface SavedScenario {
  id: string;
  name: string;
  kind: ScenarioKind;
  value: number;
  result: ScenarioResult;
  createdAt: string;
}

const Input = z.object({ kind: z.enum(Object.keys(SCENARIOS) as [ScenarioKind, ...ScenarioKind[]]), value: z.number().finite() });

/** Save a scenario. The result is recomputed here from the company's own data, never taken from the browser. */
export async function saveScenario(companyId: string, kind: string, value: number): Promise<ActionResult<SavedScenario>> {
  try {
    const ws = await workspaceForAction(companyId);
    requireFeature(ws.entitlements, "simulator", "Saving simulations");
    rateLimit(`mutate:${ws.user.id}`, LIMITS.mutate);
    const p = Input.parse({ kind, value });
    const { analysis } = await getAnalysis(ws);
    if (!analysis.baseline) throw new UserError("Upload data before running simulations.");
    const result = simulate(analysis.baseline, p.kind, p.value, ws.company.currency);
    const count = await db.scenario.count({ where: { companyId: ws.company.id } });
    if (count >= 50) throw new UserError("You have 50 saved scenarios. Delete some to save more.");
    const row = await db.scenario.create({
      data: {
        companyId: ws.company.id,
        createdById: ws.user.id,
        name: result.question,
        kind: p.kind,
        inputs: { value: result.value },
        results: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/app/what-if");
    return { ok: true, data: { id: row.id, name: row.name, kind: p.kind, value: result.value, result, createdAt: row.createdAt.toISOString() } };
  } catch (e) {
    return toActionError(e, "We couldn't save that simulation. Please try again.");
  }
}

export async function deleteScenario(id: string): Promise<ActionResult> {
  try {
    const ws = await workspaceForAction();
    rateLimit(`mutate:${ws.user.id}`, LIMITS.mutate);
    if (typeof id !== "string" || id.length > 40) throw new UserError("That scenario doesn't exist.");
    await db.scenario.deleteMany({ where: { id, companyId: ws.company.id } });
    revalidatePath("/app/what-if");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e, "We couldn't delete that scenario.");
  }
}
