"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { finishExperiment, stopExperiment } from "@/server/dal/experiments";
import { merchantForAction } from "@/server/dal/session";
import { UserError } from "@/server/errors";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import type { ActionResult } from "./actions";

const id = z.string().min(1).max(40);

async function guarded<T>(fn: (merchantId: string) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const m = await merchantForAction();
    rateLimit(`mutate:${m.id}`, LIMITS.mutate.limit, LIMITS.mutate.windowMs);
    const data = await fn(m.id);
    revalidatePath("/studio/experiments");
    revalidatePath("/studio", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Invalid input" };
    console.error("[experiment action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Ship B (publishes its design/price) or keep the original. Either way the test ends. */
export async function finishExperimentAction(input: { experimentId: string; winner: "A" | "B" }) {
  return guarded((m) => finishExperiment(m, id.parse(input.experimentId), z.enum(["A", "B"]).parse(input.winner)));
}

export async function stopExperimentAction(input: { experimentId: string }) {
  return guarded(async (m) => {
    await stopExperiment(m, id.parse(input.experimentId));
    return null;
  });
}
