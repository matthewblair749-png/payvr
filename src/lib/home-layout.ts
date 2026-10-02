import { z } from "zod";
import { RANGES, type RangeValue } from "./date-range";

/** Home's rearrangeable sections, in their default order. */
export const SECTIONS = [
  { key: "brief", label: "Morning brief" },
  { key: "northStar", label: "Revenue" },
  { key: "kpis", label: "Orders, conversion, AOV and refunds" },
  { key: "funnel", label: "Checkout funnel" },
  { key: "feed", label: "Live sales" },
  { key: "why", label: "Why they buy" },
  { key: "experiment", label: "Experiment" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];
export const SECTION_KEYS = SECTIONS.map((s) => s.key) as SectionKey[];
export const sectionLabel = (k: SectionKey) => SECTIONS.find((s) => s.key === k)!.label;

export type HomeLayout = { order: SectionKey[]; hidden: SectionKey[] };
export type HomeView = HomeLayout & { id: string; name: string; range: RangeValue };

export const DEFAULT_LAYOUT: HomeLayout = { order: SECTION_KEYS, hidden: [] };
export const MAX_VIEWS = 8;

const key = z.enum(SECTION_KEYS as [SectionKey, ...SectionKey[]]);
export const layoutSchema = z.object({ order: z.array(key).max(20), hidden: z.array(key).max(20) });
export const viewNameSchema = z.string().trim().min(1, "Give the view a name.").max(40, "Keep the name under 40 characters.");
const viewSchema = layoutSchema.extend({
  id: z.string().min(1).max(40),
  name: viewNameSchema,
  range: z.enum(RANGES.map((r) => r.value) as [RangeValue, ...RangeValue[]]),
});

/**
 * Any stored or submitted layout, made whole: every section exactly once
 * (sections it doesn't list join at the end), unknown keys dropped. Never throws.
 */
export function normalizeLayout(raw: unknown): HomeLayout {
  const parsed = layoutSchema.safeParse(raw);
  if (!parsed.success) return { order: [...SECTION_KEYS], hidden: [] };
  const listed = [...new Set(parsed.data.order)];
  const order = [...listed, ...SECTION_KEYS.filter((k) => !listed.includes(k))];
  const hidden = SECTION_KEYS.filter((k) => parsed.data.hidden.includes(k));
  // Home is never left empty.
  return { order, hidden: hidden.length === order.length ? [] : hidden };
}

export function normalizeViews(raw: unknown): HomeView[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((v) => {
      const p = viewSchema.safeParse(v);
      return p.success ? [{ ...p.data, ...normalizeLayout(p.data) }] : [];
    })
    .slice(0, MAX_VIEWS);
}

export const sameLayout = (a: HomeLayout, b: HomeLayout) =>
  a.order.join() === b.order.join() && [...a.hidden].sort().join() === [...b.hidden].sort().join();

/** Moves one section up (-1) or down (+1). */
export function move(layout: HomeLayout, k: SectionKey, by: -1 | 1): HomeLayout {
  const order = [...layout.order];
  const i = order.indexOf(k);
  const j = i + by;
  if (i < 0 || j < 0 || j >= order.length) return layout;
  [order[i], order[j]] = [order[j], order[i]];
  return { ...layout, order };
}

/**
 * Groups the visible sections into rows: the wide cards stand alone, while
 * runs of the small cards (feed, why, experiment) share a row on big screens.
 */
const SMALL: SectionKey[] = ["feed", "why", "experiment"];
export function rows(layout: HomeLayout): SectionKey[][] {
  const out: SectionKey[][] = [];
  for (const k of layout.order) {
    if (layout.hidden.includes(k)) continue;
    const last = out.at(-1);
    if (SMALL.includes(k) && last && SMALL.includes(last[0])) last.push(k);
    else out.push([k]);
  }
  return out;
}
