"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aggregate, type ImportSummary, type Mapping } from "@/lib/csv/aggregate";
import { detectColumns, TARGETS, type CsvFormat, type DatasetMeta, type Target } from "@/lib/csv/detect";
import { CSV_LIMITS, CsvError, parseCsv } from "@/lib/csv/parse";
import { Prisma } from "@/generated/prisma/client";
import { refreshAnalysis } from "../analysis/refresh";
import { requireFeature } from "../billing/entitlements";
import { db } from "../db";
import { GENERIC_ERROR, UserError } from "../errors";
import { LIMITS, rateLimit, RateLimitError } from "../rate-limit";
import { requireRole, workspaceForAction } from "../workspace";

export type UploadState = { error?: string } | undefined;

const ALLOWED_TYPES = new Set(["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "text/comma-separated-values", ""]);
const monthDate = (p: string) => new Date(`${p}-01T00:00:00Z`);
const FRIENDLY = "We couldn't analyze this dataset. Check the file and try again.";

function friendly(e: unknown): string {
  if (e instanceof CsvError || e instanceof UserError || e instanceof RateLimitError) return e.message;
  if (e && typeof e === "object" && "digest" in e) throw e; // redirect / notFound
  console.error("[pivot] upload failed", e);
  return FRIENDLY;
}

function decode(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    // Excel on Windows often saves CSVs as Windows-1252.
    return new TextDecoder("windows-1252").decode(buf);
  }
}

const safeName = (s: string) => s.replace(/[^\p{L}\p{N} ._()&-]/gu, "").trim().slice(0, 80) || "dataset.csv";

/** Step 1: validate and parse the file, detect columns, and save it for review. */
export async function uploadDataset(_prev: UploadState, form: FormData): Promise<UploadState> {
  let id: string;
  try {
    const ws = await workspaceForAction(form.get("companyId") ?? "");
    requireRole(ws, ["OWNER", "ADMIN"], "upload data");
    requireFeature(ws.entitlements, "uploads", "Uploading your own data");
    rateLimit(`upload:${ws.company.id}`, LIMITS.upload);

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Choose a CSV file to upload.");
    if (file.size > CSV_LIMITS.maxBytes) throw new UserError("That file is over 10 MB. Upload a monthly summary or split the file.");
    if (!/\.csv$/i.test(file.name) || !ALLOWED_TYPES.has(file.type)) throw new UserError("PIVOT reads CSV files. In Excel or Google Sheets, use File → Save as / Download → CSV.");

    const limit = ws.entitlements.limits.datasets;
    if (limit !== null) {
      const count = await db.uploadedDataset.count({ where: { companyId: ws.company.id, dataSource: { kind: "CSV_UPLOAD" } } });
      if (count >= limit) throw new UserError(`Your plan holds ${limit} dataset${limit === 1 ? "" : "s"}. Delete one or upgrade to add more.`);
    }

    const text = decode(await file.arrayBuffer());
    const parsed = parseCsv(text, ws.entitlements.limits.rowsPerFile);
    const { columns, format } = detectColumns(parsed.header, parsed.rows, parsed.delimiter);
    const mapping: Mapping = Object.fromEntries(columns.map((c) => [c.name, c.target]));

    const source = await db.dataSource.upsert({
      where: { companyId_kind: { companyId: ws.company.id, kind: "CSV_UPLOAD" } },
      create: { companyId: ws.company.id, kind: "CSV_UPLOAD", name: "CSV uploads" },
      update: {},
    });
    const fileName = safeName(file.name);
    const ds = await db.uploadedDataset.create({
      data: {
        companyId: ws.company.id,
        dataSourceId: source.id,
        createdById: ws.user.id,
        name: fileName.replace(/\.csv$/i, ""),
        fileName,
        fileSize: file.size,
        rowCount: parsed.rows.length,
        columns: { format, columns } satisfies DatasetMeta as unknown as Prisma.InputJsonValue,
        mapping,
        preview: { header: parsed.header, rows: parsed.rows.slice(0, 20) },
        rawCsv: text,
        status: "PENDING_REVIEW",
      },
    });
    id = ds.id;
  } catch (e) {
    return { error: friendly(e) };
  }
  redirect(`/app/data/review/${id}`);
}

const MappingSchema = z.record(z.string().max(80), z.enum(Object.keys(TARGETS) as [Target, ...Target[]]));

async function loadOwned(id: string) {
  const ws = await workspaceForAction();
  requireRole(ws, ["OWNER", "ADMIN"], "change data");
  if (typeof id !== "string" || id.length > 40) throw new UserError("That dataset doesn't exist.");
  const ds = await db.uploadedDataset.findFirst({ where: { id, companyId: ws.company.id }, include: { dataSource: { select: { kind: true } } } });
  if (!ds) throw new UserError("That dataset doesn't exist.");
  if (ds.dataSource.kind !== "CSV_UPLOAD") throw new UserError("Sample data can't be re-mapped.");
  return { ws, ds };
}

const FormatSchema = z.object({ dayFirst: z.boolean(), decimalComma: z.boolean() }).optional();

/** The chosen format, else the one saved with the dataset (older uploads only saved `dayFirst`). */
function formatOf(meta: DatasetMeta, chosen?: CsvFormat): CsvFormat {
  return chosen ?? { dayFirst: meta.format?.dayFirst ?? meta.dayFirst ?? false, decimalComma: meta.format?.decimalComma ?? false };
}

function run(ds: { rawCsv: string; columns: unknown }, mapping: Mapping, chosen?: CsvFormat) {
  const parsed = parseCsv(ds.rawCsv);
  for (const k of Object.keys(mapping)) if (!parsed.header.includes(k)) throw new UserError("The column mapping doesn't match this file.");
  return aggregate(parsed, mapping, formatOf(ds.columns as unknown as DatasetMeta, chosen));
}

/** Live preview of what a mapping would import (review screen). */
export async function previewImport(id: string, mapping: Record<string, string>, format?: CsvFormat): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  try {
    const { ws, ds } = await loadOwned(id);
    // Each preview re-parses the stored file: cap how often.
    rateLimit(`preview:${ws.user.id}`, { limit: 120, windowMs: 60_000 });
    const { summary } = run(ds, MappingSchema.parse(mapping), FormatSchema.parse(format));
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

/** Step 2: import with the confirmed mapping, then re-run the analysis. */
export async function confirmImport(id: string, mapping: Record<string, string>, format?: CsvFormat): Promise<{ error: string } | undefined> {
  try {
    const { ws, ds } = await loadOwned(id);
    rateLimit(`mutate:${ws.user.id}`, LIMITS.mutate);
    const m = MappingSchema.parse(mapping);
    const meta = ds.columns as unknown as DatasetMeta;
    const fmt = formatOf(meta, FormatSchema.parse(format));
    const { rows, summary } = run(ds, m, fmt);
    await db.$transaction(
      async (tx) => {
        // Your own data replaces the sample data, so the two never mix.
        await tx.uploadedDataset.deleteMany({ where: { companyId: ws.company.id, dataSource: { kind: "SAMPLE" } } });
        await tx.metric.deleteMany({ where: { datasetId: ds.id } });
        await tx.metric.createMany({
          data: rows.map((r) => ({ companyId: ws.company.id, datasetId: ds.id, period: monthDate(r.period), key: r.key, dimension: r.dimension, value: r.value })),
        });
        await tx.uploadedDataset.update({
          where: { id: ds.id },
          data: {
            mapping: m,
            // Remember the format the user confirmed, so re-mapping later reads the file the same way.
            columns: { ...meta, format: { ...meta.format, ...fmt } } as unknown as Prisma.InputJsonValue,
            status: "READY",
            periodStart: monthDate(summary.months[0]), periodEnd: monthDate(summary.months[summary.months.length - 1]) },
        });
        await tx.dataSource.update({ where: { id: ds.dataSourceId }, data: { lastSyncedAt: new Date() } });
        await tx.company.update({ where: { id: ws.company.id }, data: { dataVersion: { increment: 1 } } });
      },
      { timeout: 60_000 },
    );
    await refreshAnalysis(ws.company.id);
    revalidatePath("/app", "layout");
  } catch (e) {
    return { error: friendly(e) };
  }
  redirect("/app?imported=data");
}

/** Throw away an upload that hasn't been imported, or delete an imported dataset and its metrics. */
export async function deleteDataset(id: string): Promise<{ error: string } | undefined> {
  try {
    const ws = await workspaceForAction();
    requireRole(ws, ["OWNER", "ADMIN"], "delete data");
    rateLimit(`mutate:${ws.user.id}`, LIMITS.mutate);
    if (typeof id !== "string" || id.length > 40) throw new UserError("That dataset doesn't exist.");
    const ds = await db.uploadedDataset.findFirst({ where: { id, companyId: ws.company.id }, select: { id: true, status: true } });
    if (!ds) throw new UserError("That dataset doesn't exist.");
    await db.$transaction([
      db.uploadedDataset.delete({ where: { id: ds.id } }),
      ...(ds.status === "READY" ? [db.company.update({ where: { id: ws.company.id }, data: { dataVersion: { increment: 1 } } })] : []),
    ]);
    if (ds.status === "READY") await refreshAnalysis(ws.company.id);
    revalidatePath("/app", "layout");
  } catch (e) {
    return { error: e instanceof UserError || e instanceof RateLimitError ? e.message : (console.error(e), GENERIC_ERROR) };
  }
  redirect("/app/data");
}
