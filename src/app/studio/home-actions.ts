"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseRange } from "@/lib/date-range";
import { type HomeView, layoutSchema, MAX_VIEWS, normalizeLayout, normalizeViews, viewNameSchema } from "@/lib/home-layout";
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

/** Save Home's section order and hidden sections (a viewing preference, so allowed on sample data too). */
export async function saveHomeLayoutAction(input: unknown) {
  const m = await merchantForAction();
  rateLimit(`mutate:${m.id}`, LIMITS.mutate.limit, LIMITS.mutate.windowMs);
  const layout = normalizeLayout(layoutSchema.parse(input));
  await db.merchant.update({ where: { id: m.id }, data: { homeLayout: layout } });
  return { ok: true as const, layout };
}

/** Save the current layout and range as a named view (same name replaces it). */
export async function saveHomeViewAction(input: { name: unknown; range: unknown; layout: unknown }) {
  const m = await merchantForAction();
  rateLimit(`mutate:${m.id}`, LIMITS.mutate.limit, LIMITS.mutate.windowMs);
  const name = viewNameSchema.safeParse(input.name);
  if (!name.success) return { ok: false as const, error: name.error.issues[0].message };
  const layout = normalizeLayout(layoutSchema.parse(input.layout));
  const range = parseRange(input.range);
  const views = normalizeViews(m.homeViews);
  const existing = views.find((v) => v.name.toLowerCase() === name.data.toLowerCase());
  if (!existing && views.length >= MAX_VIEWS) {
    return { ok: false as const, error: `You can keep ${MAX_VIEWS} views. Delete one to save another.` };
  }
  const view: HomeView = { id: existing?.id ?? randomUUID().slice(0, 8), name: name.data, range, ...layout };
  const next = existing ? views.map((v) => (v.id === existing.id ? view : v)) : [...views, view];
  await db.merchant.update({ where: { id: m.id }, data: { homeViews: next, homeLayout: layout } });
  return { ok: true as const, views: next, view };
}

export async function deleteHomeViewAction(input: { id: unknown }) {
  const m = await merchantForAction();
  rateLimit(`mutate:${m.id}`, LIMITS.mutate.limit, LIMITS.mutate.windowMs);
  const id = z.string().max(40).parse(input.id);
  const next = normalizeViews(m.homeViews).filter((v) => v.id !== id);
  await db.merchant.update({ where: { id: m.id }, data: { homeViews: next } });
  return { ok: true as const, views: next };
}
