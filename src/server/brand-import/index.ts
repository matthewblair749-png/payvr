import "server-only";
import { extractSignals, type BrandSignals } from "@/lib/brand/extract";
import { guessFromSignals, type BrandGuess } from "@/lib/brand/heuristics";
import { refineWithClaude, type ImageInput } from "./ai";
import { safeFetch } from "./safe-fetch";

export type BrandImportResult = BrandGuess & {
  source: "ai" | "heuristic";
  sourceUrl: string;
  elapsedMs: number;
};

const IMAGE_TYPES = /^image\/(png|jpeg|webp|gif)\b/;

/**
 * Paste a link → matching checkout theme.
 * Budget: ~4-6s fetching + ~3-6s Claude. Every step degrades gracefully.
 */
export async function importBrand(rawUrl: string): Promise<BrandImportResult> {
  const started = Date.now();
  const deadline = AbortSignal.timeout(14_000);

  const page = await safeFetch(rawUrl, {
    maxBytes: 1_500_000,
    accept: /^text\/html|application\/xhtml\+xml/,
    truncate: true,
    timeoutMs: 6_000,
    signal: deadline,
  });
  const html = page.body.toString("utf8");

  // First pass (no external CSS) tells us which stylesheets to fetch.
  const first = extractSignals(html, page.url.toString());
  const [cssTexts, image] = await Promise.all([
    Promise.all(
      first.stylesheetUrls.slice(0, 3).map((u) =>
        safeFetch(u, { maxBytes: 400_000, accept: /^text\/css|text\/plain/, truncate: true, timeoutMs: 3_000, signal: deadline })
          .then((r) => r.body.toString("utf8"))
          .catch(() => ""),
      ),
    ),
    fetchLogoImage(first, deadline),
  ]);

  const signals = extractSignals(html, page.url.toString(), cssTexts);
  const baseline = guessFromSignals(signals);
  const refined = await refineWithClaude(signals, baseline, image, deadline);

  return {
    ...(refined ?? baseline),
    source: refined ? "ai" : "heuristic",
    sourceUrl: page.url.toString(),
    elapsedMs: Date.now() - started,
  };
}

/** Grab the best logo candidate (or og:image for Instagram profiles) as base64 for Claude. */
async function fetchLogoImage(s: BrandSignals, signal: AbortSignal): Promise<ImageInput | null> {
  const candidates = s.isInstagram && s.ogImage ? [s.ogImage] : [...s.logoCandidates, ...(s.ogImage ? [s.ogImage] : [])];
  for (const url of candidates.slice(0, 2)) {
    try {
      const r = await safeFetch(url, { maxBytes: 2_000_000, accept: IMAGE_TYPES, timeoutMs: 3_000, signal });
      const mediaType = r.contentType.match(IMAGE_TYPES)?.[0] as ImageInput["mediaType"] | undefined;
      if (mediaType && r.body.length > 200) return { mediaType, base64: r.body.toString("base64") };
    } catch {
      /* try next */
    }
  }
  return null;
}
