import { createHash } from "node:crypto";
import type { LanguageCode, SourceLanguage } from "../languages";
import type { Formality } from "../types";

export interface CacheKeyParts {
  provider: string;
  text: string;
  from: SourceLanguage;
  to: LanguageCode;
  formality: Formality;
}

export interface CachedTranslation {
  text: string;
  from: LanguageCode | "unknown";
}

/**
 * Where finished translations live so the same text is never translated twice.
 * Phase 1 ships the in-memory store below; Phase 2 adds a Postgres-backed one
 * (TranslationCache model) behind this same interface.
 */
export interface TranslationCache {
  get(key: string): Promise<CachedTranslation | null>;
  set(key: string, value: CachedTranslation): Promise<void>;
}

/**
 * Cache key: a SHA-256 of everything that changes the output. Hashing means
 * the key itself never contains the user's text.
 */
export function cacheKey({ provider, text, from, to, formality }: CacheKeyParts): string {
  const normalized = text.trim().replace(/\r\n/g, "\n");
  return createHash("sha256")
    .update([provider, from, to, formality, normalized].join("\u0000"))
    .digest("hex");
}

/** Small LRU cache. Per server instance, gone on restart. */
export class MemoryTranslationCache implements TranslationCache {
  private readonly entries = new Map<string, CachedTranslation>();

  constructor(private readonly maxEntries = 5_000) {}

  async get(key: string): Promise<CachedTranslation | null> {
    const hit = this.entries.get(key);
    if (!hit) return null;
    // Re-insert to mark as most recently used.
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit;
  }

  async set(key: string, value: CachedTranslation): Promise<void> {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
