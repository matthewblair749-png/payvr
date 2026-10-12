import "server-only";
import type { Db } from "@/server/db";
import { isLanguageCode } from "../languages";
import type { CachedTranslation, TranslationCache } from "./cache";

/** Refresh lastUsedAt at most this often, to keep cache reads cheap. */
const TOUCH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Postgres-backed translation cache. Rows are keyed by the SHA-256 from
 * cacheKey(), so the original text is never stored or linked to anyone.
 */
export class PrismaTranslationCache implements TranslationCache {
  constructor(private readonly db: Db) {}

  async get(key: string): Promise<CachedTranslation | null> {
    const row = await this.db.translationCache.findUnique({ where: { key } });
    if (!row) return null;
    if (Date.now() - row.lastUsedAt.getTime() > TOUCH_AFTER_MS) {
      await this.db.translationCache.update({ where: { key }, data: { lastUsedAt: new Date() } });
    }
    return { text: row.text, from: isLanguageCode(row.fromLang) ? row.fromLang : "unknown" };
  }

  async set(key: string, value: CachedTranslation, provider: string): Promise<void> {
    // skipDuplicates: two requests finishing the same translation is fine.
    await this.db.translationCache.createMany({
      data: [{ key, text: value.text, fromLang: value.from, provider }],
      skipDuplicates: true,
    });
  }

  /** Deletes entries nobody has used since `before`. Returns how many went. */
  async prune(before: Date): Promise<number> {
    const { count } = await this.db.translationCache.deleteMany({ where: { lastUsedAt: { lt: before } } });
    return count;
  }
}
