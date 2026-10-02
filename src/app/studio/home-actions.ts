"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { merchantForAction } from "@/server/dal/session";
import { LIMITS, rateLimit } from "@/server/rate-limit";

/** Turn the demo shop's sample data on Home on or off. */
export async function setShowSampleAction(input: { show: boolean }) {
  const m = await merchantForAction();
  rateLimit(`mutate:${m.id}`, LIMITS.mutate.limit, LIMITS.mutate.windowMs);
  const show = z.boolean().parse(input.show);
  await db.merchant.update({ where: { id: m.id }, data: { showSample: show } });
  revalidatePath("/studio", "layout");
  return { ok: true as const };
}
