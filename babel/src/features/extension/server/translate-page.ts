import "server-only";
import { z } from "zod";
import { LANGUAGE_CODES, type LanguageCode } from "@/features/translation/languages";
import type { TranslateFn } from "@/features/translation/server/translate";
import { EXTENSION_LIMITS } from "../limits";

export const pageTranslateSchema = z
  .object({
    /** Random id the extension makes per page view; the page is counted once per language. */
    pageId: z.string().regex(/^[\w-]{8,64}$/),
    to: z.enum(LANGUAGE_CODES),
    segments: z.array(z.string().max(EXTENSION_LIMITS.maxSegmentChars)).min(1).max(EXTENSION_LIMITS.maxSegments),
  })
  .refine((v) => v.segments.reduce((n, s) => n + s.length, 0) <= EXTENSION_LIMITS.maxRequestChars, {
    message: `At most ${EXTENSION_LIMITS.maxRequestChars} characters per request`,
  });

/**
 * Translates a page's text pieces, a few at a time. A piece that fails comes
 * back as null and the extension leaves the original in place.
 */
export async function translateSegments(
  translate: TranslateFn,
  segments: string[],
  to: LanguageCode,
  concurrency: number = EXTENSION_LIMITS.concurrency,
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(segments.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < segments.length) {
      const i = next++;
      try {
        results[i] = (await translate(segments[i], "auto", to)).text;
      } catch {
        results[i] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, segments.length) }, worker));
  return results;
}
