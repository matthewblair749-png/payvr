"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { buildReport, dataAsOf, reportablePeriods } from "@/lib/engine/report";
import { analyze } from "@/lib/engine/analyze";
import { monthLabel } from "@/lib/format";
import { Prisma } from "@/generated/prisma/client";
import { providerFor } from "../ai";
import { buildAIFacts } from "../ai/facts";
import { requireFeature } from "../billing/entitlements";
import { loadBusinessData } from "./business-data";
import { db } from "../db";
import { toActionError, UserError, type ActionResult } from "../errors";
import { LIMITS, rateLimit } from "../rate-limit";
import { workspaceForAction } from "../workspace";

export async function generateReport(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const ws = await workspaceForAction();
    requireFeature(ws.entitlements, "reports", "Monthly reports");
    rateLimit(`report:${ws.company.id}`, LIMITS.report);
    const period = z.string().regex(/^\d{4}-\d{2}$/).parse(form.get("period"));
    const data = await loadBusinessData(ws.company);
    if (!reportablePeriods(data).includes(period)) throw new UserError("Pick a month that has data (and a month before it to compare with).");

    // Written summary: AI when available (grounded and checked), otherwise the engine's.
    let summary: { headline: string; body: string; source: "ai" | "engine" } | undefined;
    const provider = providerFor(ws);
    if (provider.id !== "local") {
      const asOf = dataAsOf(data, period);
      const s = await provider.summarize(buildAIFacts(analyze(asOf), asOf), AbortSignal.timeout(25_000)).catch(() => null);
      if (s) summary = { ...s, source: "ai" };
    }
    const { content } = buildReport(data, period, summary);
    const row = await db.report.create({
      data: {
        companyId: ws.company.id,
        createdById: ws.user.id,
        title: `Monthly Business Report: ${monthLabel(period)}`,
        period,
        content: JSON.parse(JSON.stringify(content)) as Prisma.InputJsonValue,
      },
    });
    id = row.id;
  } catch (e) {
    return toActionError(e, "We couldn't generate that report. Please try again.");
  }
  redirect(`/app/reports/${id}`);
}

export async function deleteReport(reportId: string): Promise<ActionResult> {
  try {
    const ws = await workspaceForAction();
    rateLimit(`mutate:${ws.user.id}`, LIMITS.mutate);
    if (typeof reportId !== "string" || reportId.length > 40) throw new UserError("That report doesn't exist.");
    await db.report.deleteMany({ where: { id: reportId, companyId: ws.company.id } });
  } catch (e) {
    return toActionError(e);
  }
  redirect("/app/reports");
}
