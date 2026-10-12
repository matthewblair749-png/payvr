import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { getPlan } from "@/config/plans";
import { EXTENSION_LIMITS } from "@/features/extension/limits";
import { browserLabel, createExtensionToken, revokeExtensionToken, userForToken } from "@/features/extension/server/tokens";
import { pageTranslateSchema, translateSegments } from "@/features/extension/server/translate-page";
import type { TranslateFn } from "@/features/translation/server/translate";
import { createUser, describeDb, testDb } from "./helpers/db";

describe("browserLabel", () => {
  it("names the browser and system without keeping the user agent", () => {
    expect(browserLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36")).toBe(
      "Chrome on macOS",
    );
    expect(browserLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0")).toBe("Edge on Windows");
    expect(browserLabel(null)).toBe("A browser");
  });
});

describe("page request validation", () => {
  const base = { pageId: "page-12345678", to: "es" };
  it("accepts a normal batch", () => {
    expect(pageTranslateSchema.safeParse({ ...base, segments: ["Hello", "World"] }).success).toBe(true);
  });
  it("refuses too many pieces, too-long pieces and too much text in total", () => {
    expect(pageTranslateSchema.safeParse({ ...base, segments: Array(EXTENSION_LIMITS.maxSegments + 1).fill("x") }).success).toBe(false);
    expect(pageTranslateSchema.safeParse({ ...base, segments: ["x".repeat(EXTENSION_LIMITS.maxSegmentChars + 1)] }).success).toBe(false);
    const big = Array(5).fill("x".repeat(EXTENSION_LIMITS.maxRequestChars / 4));
    expect(pageTranslateSchema.safeParse({ ...base, segments: big }).success).toBe(false);
    expect(pageTranslateSchema.safeParse({ ...base, segments: [] }).success).toBe(false);
    expect(pageTranslateSchema.safeParse({ ...base, pageId: "../../etc", segments: ["x"] }).success).toBe(false);
  });
});

describe("translateSegments", () => {
  it("keeps order, runs a few at a time, and turns failures into null", async () => {
    let running = 0;
    let peak = 0;
    const translate: TranslateFn = async (text, _from, to) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (text === "bad") throw new Error("nope");
      return { text: `${to}:${text}`, from: "en", to, provider: "fake", cached: false };
    };
    const segments = ["a", "b", "bad", "c", "d", "e", "f", "g", "h", "i"];
    const result = await translateSegments(translate, segments, "fr", 3);
    expect(result).toEqual(["fr:a", "fr:b", null, "fr:c", "fr:d", "fr:e", "fr:f", "fr:g", "fr:h", "fr:i"]);
    expect(peak).toBe(3);
  });
});

describeDb("extension tokens and API (Postgres)", () => {
  it("issues a token that identifies the user, until it's revoked", async () => {
    const user = await createUser();
    const token = await createExtensionToken(testDb, user.id, "Chrome on macOS");
    expect(token).toMatch(/^bx_/);
    expect(await userForToken(testDb, `Bearer ${token}`)).toBe(user.id);
    expect(await userForToken(testDb, `Bearer ${token}x`)).toBeNull();
    expect(await userForToken(testDb, token)).toBeNull();
    expect(await testDb.extensionToken.count({ where: { tokenHash: token } })).toBe(0); // only the hash is stored

    const row = await testDb.extensionToken.findFirstOrThrow({ where: { userId: user.id } });
    const stranger = await createUser();
    await revokeExtensionToken(testDb, stranger.id, row.id); // not theirs: no effect
    expect(await userForToken(testDb, `Bearer ${token}`)).toBe(user.id);
    await revokeExtensionToken(testDb, user.id, row.id);
    expect(await userForToken(testDb, `Bearer ${token}`)).toBeNull();
  });

  async function callRoute(token: string | null, body: unknown) {
    vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL ?? "");
    const { POST } = await import("@/app/api/extension/translate/route");
    const headers = new Headers({ "content-type": "application/json" });
    if (token) headers.set("authorization", `Bearer ${token}`);
    return POST(new Request("http://localhost/api/extension/translate", { method: "POST", headers, body: JSON.stringify(body) }));
  }

  it("refuses requests without a valid token", async () => {
    const res = await callRoute(null, { pageId: "page-12345678", to: "es", segments: ["Hi"] });
    expect(res.status).toBe(401);
  });

  it("translates a page and counts it once, however many requests it takes", async () => {
    const user = await createUser();
    const token = await createExtensionToken(testDb, user.id, "Test");
    const pageId = `page-${randomUUID()}`;
    const first = await callRoute(token, { pageId, to: "es", segments: ["This soup tastes just like my grandmother's.", "Unknown words here"] });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, translations: ["Esta sopa sabe igual que la de mi abuela.", null] });

    await callRoute(token, { pageId, to: "es", segments: ["More text from the same page"] });
    expect(await testDb.usageEvent.count({ where: { userId: user.id, kind: "translation" } })).toBe(1);

    // The same page in another language is another translation.
    await callRoute(token, { pageId, to: "fr", segments: ["Hello"] });
    expect(await testDb.usageEvent.count({ where: { userId: user.id, kind: "translation" } })).toBe(2);
  });

  it("stops new pages at the daily limit but lets the current page finish", async () => {
    const user = await createUser();
    const token = await createExtensionToken(testDb, user.id, "Test");
    const limit = getPlan("free").limits.translationsPerDay;
    const open = `page-${randomUUID()}`;
    await callRoute(token, { pageId: open, to: "es", segments: ["Hi"] });
    await testDb.usageEvent.createMany({ data: Array.from({ length: limit - 1 }, () => ({ userId: user.id, kind: "translation" })) });

    const blocked = await callRoute(token, { pageId: `page-${randomUUID()}`, to: "es", segments: ["Hi"] });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: "limit_reached" });

    const sameOldPage = await callRoute(token, { pageId: open, to: "es", segments: ["Still loading more"] });
    expect(sameOldPage.status).toBe(200);
  });
});
