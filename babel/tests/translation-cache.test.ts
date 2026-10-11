import { describe, expect, it, vi } from "vitest";
import { cacheKey, MemoryTranslationCache } from "@/features/translation/server/cache";
import type { TranslationProvider } from "@/features/translation/server/provider";
import { createTranslator } from "@/features/translation/server/translate";

function fakeProvider(id = "fake") {
  const translateSpy = vi.fn(async ({ text, to }: { text: string; to: string }) => ({
    text: `[${to}] ${text}`,
    from: "en" as const,
  }));
  const provider: TranslationProvider = { id, translate: translateSpy };
  return { provider, translateSpy };
}

describe("cacheKey", () => {
  const base = { provider: "p", text: "Hello", from: "auto", to: "es", formality: "default" } as const;

  it("is stable and does not contain the text", () => {
    expect(cacheKey(base)).toBe(cacheKey(base));
    expect(cacheKey(base)).not.toContain("Hello");
    expect(cacheKey(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores surrounding whitespace and line-ending style", () => {
    expect(cacheKey({ ...base, text: "  Hello \r\n" })).toBe(cacheKey({ ...base, text: "Hello" }));
  });

  it("changes with anything that changes the output", () => {
    const key = cacheKey(base);
    expect(cacheKey({ ...base, provider: "q" })).not.toBe(key);
    expect(cacheKey({ ...base, to: "fr" })).not.toBe(key);
    expect(cacheKey({ ...base, from: "en" })).not.toBe(key);
    expect(cacheKey({ ...base, formality: "formal" })).not.toBe(key);
    expect(cacheKey({ ...base, text: "hello" })).not.toBe(key);
  });
});

describe("MemoryTranslationCache", () => {
  it("evicts the least recently used entry", async () => {
    const cache = new MemoryTranslationCache(2);
    await cache.set("a", { text: "A", from: "en" });
    await cache.set("b", { text: "B", from: "en" });
    await cache.get("a"); // "b" is now the oldest
    await cache.set("c", { text: "C", from: "en" });
    expect(await cache.get("b")).toBeNull();
    expect(await cache.get("a")).toEqual({ text: "A", from: "en" });
    expect(cache.size).toBe(2);
  });
});

describe("translate()", () => {
  it("never translates the same text twice", async () => {
    const { provider, translateSpy } = fakeProvider();
    const translate = createTranslator({ provider, cache: new MemoryTranslationCache() });

    const first = await translate("Good morning", "auto", "es");
    const second = await translate("Good morning", "auto", "es");

    expect(translateSpy).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ text: "[es] Good morning", cached: false, provider: "fake" });
    expect(second).toMatchObject({ text: "[es] Good morning", cached: true });
  });

  it("shares one provider call between identical concurrent requests", async () => {
    const { provider, translateSpy } = fakeProvider();
    const translate = createTranslator({ provider, cache: new MemoryTranslationCache() });

    await Promise.all([translate("Hi", "auto", "fr"), translate("Hi", "auto", "fr"), translate("Hi", "auto", "fr")]);
    expect(translateSpy).toHaveBeenCalledTimes(1);
  });

  it("does not share cache entries between providers", async () => {
    const cache = new MemoryTranslationCache();
    const a = fakeProvider("a");
    const b = fakeProvider("b");
    await createTranslator({ provider: a.provider, cache })("Hi", "auto", "de");
    await createTranslator({ provider: b.provider, cache })("Hi", "auto", "de");
    expect(b.translateSpy).toHaveBeenCalledTimes(1);
  });

  it("skips the cache entirely for private text", async () => {
    const { provider, translateSpy } = fakeProvider();
    const cache = new MemoryTranslationCache();
    const translate = createTranslator({ provider, cache });

    await translate("A secret", "auto", "es", { noCache: true });
    await translate("A secret", "auto", "es", { noCache: true });
    expect(translateSpy).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it("returns the text untouched when source and target match", async () => {
    const { provider, translateSpy } = fakeProvider();
    const translate = createTranslator({ provider, cache: new MemoryTranslationCache() });
    const result = await translate("Hola", "es", "es");
    expect(result.text).toBe("Hola");
    expect(translateSpy).not.toHaveBeenCalled();
  });

  it("does not cache failures", async () => {
    let calls = 0;
    const provider: TranslationProvider = {
      id: "flaky",
      translate: async () => {
        calls += 1;
        if (calls === 1) throw new Error("upstream down");
        return { text: "Hola", from: "en" };
      },
    };
    const translate = createTranslator({ provider, cache: new MemoryTranslationCache() });
    await expect(translate("Hi", "auto", "es")).rejects.toThrow("upstream down");
    await expect(translate("Hi", "auto", "es")).resolves.toMatchObject({ text: "Hola" });
  });
});
