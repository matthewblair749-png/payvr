import "server-only";
import type { LanguageCode, SourceLanguage } from "../languages";
import type { TranslateOptions, TranslationResult } from "../types";
import { cacheKey, MemoryTranslationCache, type TranslationCache } from "./cache";
import type { TranslationProvider } from "./provider";
import { db } from "@/server/db";
import { PrismaTranslationCache } from "./prisma-cache";
import { createProviderFromEnv } from "./providers";

export type TranslateFn = (
  text: string,
  from: SourceLanguage,
  to: LanguageCode,
  options?: TranslateOptions,
) => Promise<TranslationResult>;

/**
 * Builds the one `translate()` the app uses. The provider and cache are
 * injected so tests (and Phase 2's database cache) can swap them freely.
 */
export function createTranslator({ provider, cache }: { provider: TranslationProvider; cache: TranslationCache }): TranslateFn {
  // Identical requests that arrive together share one provider call.
  const inFlight = new Map<string, Promise<TranslationResult>>();

  return async function translate(text, from, to, options = {}) {
    const formality = options.formality ?? "default";

    // Nothing to do when source and target already match.
    if (from === to) return { text, from, to, provider: "none", cached: false };

    const key = cacheKey({ provider: provider.id, text, from, to, formality });

    if (!options.noCache) {
      const hit = await cache.get(key);
      if (hit) return { ...hit, to, provider: provider.id, cached: true };
    }

    const pending = inFlight.get(key);
    if (pending) return pending;

    const work = (async (): Promise<TranslationResult> => {
      const result = await provider.translate({ text, from, to, formality });
      if (!options.noCache) await cache.set(key, { text: result.text, from: result.from }, provider.id);
      return { ...result, to, provider: provider.id, cached: false };
    })();

    inFlight.set(key, work);
    try {
      return await work;
    } finally {
      inFlight.delete(key);
    }
  };
}

let defaultTranslator: TranslateFn | null = null;

/**
 * The app-wide translator, configured from environment variables. Caches in
 * Postgres when DATABASE_URL is set, in memory otherwise.
 */
export function translate(...args: Parameters<TranslateFn>): ReturnType<TranslateFn> {
  defaultTranslator ??= createTranslator({
    provider: createProviderFromEnv(),
    cache: process.env.DATABASE_URL ? new PrismaTranslationCache(db) : new MemoryTranslationCache(),
  });
  return defaultTranslator(...args);
}
