import "server-only";
import { after } from "next/server";
import type { Analysis, BusinessData, Summary } from "@/lib/engine/types";
import { db } from "../db";
import type { Workspace } from "../workspace";
import { anthropicProvider, AI_MODEL } from "./anthropic";
import { buildAIFacts } from "./facts";
import { localProvider } from "./local";
import type { AIProvider } from "./provider";

/** Which provider is configured for this deployment. */
export function configuredProvider(): AIProvider {
  if (process.env.PIVOT_AI_PROVIDER === "local") return localProvider;
  return process.env.ANTHROPIC_API_KEY ? anthropicProvider : localProvider;
}

/** The provider for a workspace (companies can turn AI narratives off). */
export function providerFor(ws: Workspace): AIProvider {
  return ws.company.aiNarratives ? configuredProvider() : localProvider;
}

export function aiStatus() {
  const p = configuredProvider();
  return { provider: p.id, label: p.label, model: p.id === "anthropic" ? AI_MODEL : null };
}

export type SummaryView = Summary & { source: "ai" | "engine" };

/** Finished demo summaries per period. A failure (null) is kept for a while too, so the public demo can't start an AI call on every visit, but is retried later. */
const demoSummaries = new Map<string, { value: Summary | null; at: number }>();
const DEMO_RETRY_MS = 10 * 60_000;
/** Summaries being written right now, so a burst of page views starts one AI call, not one each. */
const inFlight = new Set<string>();

/**
 * The executive summary for the overview and reports. The engine's template
 * is shown immediately; when an AI provider is available, a written summary
 * is generated after the response and cached per data version (failures
 * keep the template).
 */
export async function getSummary(ws: Workspace, analysis: Analysis, data: BusinessData): Promise<SummaryView> {
  const fallback: SummaryView = { ...analysis.summary, source: "engine" };
  const provider = providerFor(ws);
  if (provider.id === "local" || !analysis.kpis.length) return fallback;

  if (ws.mode === "demo") {
    const key = `demo:${analysis.period}`;
    const hit = demoSummaries.get(key);
    if (hit?.value) return { ...hit.value, source: "ai" };
    if (hit && Date.now() - hit.at < DEMO_RETRY_MS) return fallback;
    if (inFlight.has(key)) return fallback;
    inFlight.add(key);
    after(async () => {
      try {
        demoSummaries.set(key, { value: await provider.summarize(buildAIFacts(analysis, data)).catch(() => null), at: Date.now() });
      } finally {
        inFlight.delete(key);
      }
    });
    return fallback;
  }

  const companyId = ws.company.id;
  const version = ws.company.dataVersion;
  const stored = await db.analysisSummary.findUnique({ where: { companyId_dataVersion: { companyId, dataVersion: version } } });
  if (stored) return stored.source === "ai" ? { headline: stored.headline, body: stored.body, source: "ai" } : fallback;
  const key = `${companyId}:${version}`;
  if (inFlight.has(key)) return fallback;
  inFlight.add(key);
  after(async () => {
    try {
      const s = await provider.summarize(buildAIFacts(analysis, data));
      await db.analysisSummary.upsert({
        where: { companyId_dataVersion: { companyId, dataVersion: version } },
        create: { companyId, dataVersion: version, source: s ? "ai" : "engine", headline: s?.headline ?? fallback.headline, body: s?.body ?? fallback.body },
        update: {},
      });
    } catch (e) {
      console.error("[pivot] summary generation failed", e instanceof Error ? e.message : e);
      // Keep the template for this data version rather than retrying on every page load.
      await db.analysisSummary
        .upsert({
          where: { companyId_dataVersion: { companyId, dataVersion: version } },
          create: { companyId, dataVersion: version, source: "engine", headline: fallback.headline, body: fallback.body },
          update: {},
        })
        .catch(() => {});
    } finally {
      inFlight.delete(key);
    }
  });
  return fallback;
}
