import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { cacheKey } from "@/features/translation/server/cache";
import { PrismaTranslationCache } from "@/features/translation/server/prisma-cache";
import type { TranslationProvider } from "@/features/translation/server/provider";
import { createTranslator } from "@/features/translation/server/translate";
import { describeDb, testDb } from "./helpers/db";

describeDb("Postgres translation cache", () => {
  it("stores and returns a translation by key, without the source text", async () => {
    const cache = new PrismaTranslationCache(testDb);
    const key = cacheKey({ provider: "p", text: `secret ${randomUUID()}`, from: "auto", to: "es", formality: "default" });
    expect(await cache.get(key)).toBeNull();
    await cache.set(key, { text: "Hola", from: "en" }, "p");
    expect(await cache.get(key)).toEqual({ text: "Hola", from: "en" });
    const row = await testDb.translationCache.findUniqueOrThrow({ where: { key } });
    expect(JSON.stringify(row)).not.toContain("secret");
  });

  it("tolerates two writers finishing the same translation", async () => {
    const cache = new PrismaTranslationCache(testDb);
    const key = `k_${randomUUID()}`;
    await Promise.all([cache.set(key, { text: "A", from: "en" }, "p"), cache.set(key, { text: "A", from: "en" }, "p")]);
    expect(await cache.get(key)).toEqual({ text: "A", from: "en" });
  });

  it("survives a restart: a new translator reuses what the old one cached", async () => {
    const translateSpy = vi.fn(async () => ({ text: "Bonjour", from: "en" as const }));
    const provider: TranslationProvider = { id: `test-${randomUUID()}`, translate: translateSpy };
    const text = `Good morning ${randomUUID()}`;

    await createTranslator({ provider, cache: new PrismaTranslationCache(testDb) })(text, "auto", "fr");
    const second = await createTranslator({ provider, cache: new PrismaTranslationCache(testDb) })(text, "auto", "fr");

    expect(translateSpy).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ text: "Bonjour", cached: true });
  });

  it("prunes entries nobody has used recently", async () => {
    const cache = new PrismaTranslationCache(testDb);
    const oldKey = `old_${randomUUID()}`;
    const freshKey = `fresh_${randomUUID()}`;
    await testDb.translationCache.create({
      data: { key: oldKey, text: "x", fromLang: "en", provider: "p", lastUsedAt: new Date("2020-01-01T00:00:00Z") },
    });
    await cache.set(freshKey, { text: "y", from: "en" }, "p");
    await cache.prune(new Date("2021-01-01T00:00:00Z"));
    expect(await cache.get(oldKey)).toBeNull();
    expect(await cache.get(freshKey)).not.toBeNull();
  });
});
