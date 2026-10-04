import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { verifyRobloxSignature } from "../src/signature.js";
import { plan, nextNightStart } from "../src/notifications.js";
import { computeKpis, type GameEvent } from "../src/kpi.js";
import { createValidator } from "../src/config.js";
import { OpenCloud } from "../src/openCloud.js";
import { Storage } from "../src/storage.js";
import { createHandler, dispatchDue, type Deps } from "../src/app.js";

const shared = join(import.meta.dirname, "..", "..", "shared");
const harbor = JSON.parse(readFileSync(join(shared, "config", "harbor.json"), "utf8"));
const cycle = JSON.parse(readFileSync(join(shared, "config", "cycle.json"), "utf8"));

function sign(body: string, secret: string, t: number): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("base64")}`;
}

describe("webhook signatures", () => {
  it("accepts valid signatures and rejects tampering and replays", () => {
    const body = '{"NotificationType":"RightToErasureRequest"}';
    const header = sign(body, "s3cret", 1000);
    expect(verifyRobloxSignature(header, body, "s3cret", 1010)).toBe(true);
    expect(verifyRobloxSignature(header, body + " ", "s3cret", 1010)).toBe(false);
    expect(verifyRobloxSignature(header, body, "other", 1010)).toBe(false);
    expect(verifyRobloxSignature(header, body, "s3cret", 1000 + 3600)).toBe(false);
    expect(verifyRobloxSignature(undefined, body, "s3cret", 1000)).toBe(false);
  });
});

describe("notifications", () => {
  it("matches the game's rules: two a day, settings respected, nothing at night", () => {
    const base = Date.parse("2026-10-05T10:00:00Z") / 1000;
    const settings = { crops_ready: true, worker_income_full: true, night_starting: true, season_changed: false };
    const out = plan(
      harbor.notifications,
      [
        { type: "crops_ready", at: base },
        { type: "worker_income_full", at: base + 600 },
        { type: "night_starting", at: base + 1200 },
        { type: "season_changed", at: base + 1800 },
        { type: "night_starting", at: Date.parse("2026-10-05T23:00:00Z") / 1000 },
      ],
      settings,
      {},
      0,
    );
    expect(out.map((n) => n.type)).toEqual(["crops_ready", "night_starting"]);
  });

  it("finds the next global night start", () => {
    const epoch = Date.parse(cycle.cycleEpochUtc) / 1000;
    expect(nextNightStart(cycle, epoch)).toBe(epoch + cycle.daySeconds + cycle.duskSeconds);
  });
});

describe("KPIs", () => {
  it("computes retention, payer share, ARPDAU, subscription conversion and refund rate", () => {
    const d0 = Date.parse("2026-10-01T12:00:00Z") / 1000;
    const ev = (name: string, userId: number, dayOffset: number, props?: Record<string, unknown>): GameEvent => ({ name, userId, at: d0 + dayOffset * 86400, props });
    const events: GameEvent[] = [
      ev("session_started", 1, 0), ev("session_started", 1, 1), ev("session_started", 1, 7),
      ev("session_started", 2, 0), ev("session_started", 2, 1),
      ev("session_started", 3, 0),
      ev("session_started", 4, 0),
      ev("purchase_completed", 1, 0, { robux: 499 }),
      ev("purchase_completed", 2, 1, { robux: 99 }),
      ev("purchase_refunded", 2, 2, { robux: 99 }),
      ev("subscription_started", 1, 0),
    ];
    const k = computeKpis(events, d0 - 43200, d0 + 8 * 86400 - 43200);
    expect(k.day1Retention).toBe(0.5); // 2 of 4 came back the next day
    expect(k.day7Retention).toBe(0.25);
    expect(k.payerShare).toBe(0.5);
    expect(k.grossRobux).toBe(598);
    expect(k.arpdauRobux).toBeCloseTo(598 / 7, 6); // 7 player-days
    expect(k.subscriptionConversion).toBe(0.25);
    expect(k.refundRate).toBeCloseTo(99 / 598, 6);
  });
});

describe("config validation", () => {
  const validate = createValidator(shared);
  it("accepts tuning changes", () => {
    expect(validate({ economy: { eggPriceSilver: 120 }, drifters: { pity: { epicOrBetterEvery: 20 } } })).toEqual([]);
  });
  it("rejects bad shapes and anything that would sell power", () => {
    expect(validate({ economy: { eggPriceSilver: -5 } }).length).toBeGreaterThan(0);
    expect(validate({ catalog: { harborPass: { paidTrack: [{ tier: 1, silver: 500 }] } } }).join()).toContain("gameplay rewards");
    expect(validate({ nonsense: {} } as any).join()).toContain("unknown section");
  });
});

describe("HTTP routes", () => {
  async function start() {
    const calls: { method: string; url: string; body?: string }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ method: init.method!, url, body: init.body as string | undefined });
      if (init.method === "GET") return new Response("[]", { status: 200 });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const dir = mkdtempSync(join(tmpdir(), "tidebound-"));
    let now = 2_000_000_000;
    const deps: Deps = {
      env: { port: 0, gameSecret: "game", adminKey: "admin", webhookSecret: "hook", openCloudKey: "key", universeId: "42", notificationMessageIds: { crops_ready: "m1", night_starting: "m2" }, dataDir: dir },
      cloud: new OpenCloud("key", "42", fakeFetch),
      storage: new Storage(dir),
      validateConfig: createValidator(shared),
      notificationRules: harbor.notifications,
      cycle,
      seasons: harbor.seasons,
      now: () => now,
    };
    const server = createServer(createHandler(deps));
    await new Promise<void>((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
      fetch(base + path, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });
    return { calls, deps, post, close: () => server.close(), setNow: (t: number) => (now = t) };
  }

  it("requires the right secret for game and admin routes", async () => {
    const s = await start();
    expect((await s.post("/v1/events", { events: [] })).status).toBe(401);
    expect((await s.post("/v1/events", { events: [] }, { authorization: "Bearer admin" })).status).toBe(401);
    expect((await s.post("/v1/events", { events: [] }, { authorization: "Bearer game" })).status).toBe(200);
    expect((await s.post("/admin/config", { overrides: {} }, { authorization: "Bearer game" })).status).toBe(401);
    s.close();
  });

  it("handles a Roblox right-to-erasure webhook: deletes saves and closes live sessions", async () => {
    const s = await start();
    await s.post("/v1/events", { events: [{ name: "session_started", userId: 77, at: 1 }, { name: "session_started", userId: 78, at: 1 }] }, { authorization: "Bearer game" });
    const body = JSON.stringify({ NotificationType: "RightToErasureRequest", EventPayload: { UserId: 77, GameIds: [42] } });
    expect((await s.post("/webhooks/roblox", body, { "roblox-signature": "t=1,v1=bad" })).status).toBe(401);
    const res = await s.post("/webhooks/roblox", body, { "roblox-signature": sign(body, "hook", 2_000_000_000) });
    expect(res.status).toBe(200);
    const deletes = s.calls.filter((c) => c.method === "DELETE").map((c) => c.url);
    expect(deletes.some((u) => u.includes("datastoreName=Players") && u.includes("entryKey=u77"))).toBe(true);
    expect(s.calls.some((c) => c.url.includes("topics/tidebound-erase") && c.body?.includes("77"))).toBe(true);
    expect(s.deps.storage.readEvents().map((e) => e.userId)).toEqual([78]);
    s.close();
  });

  it("publishes valid live config and refuses invalid config", async () => {
    const s = await start();
    const bad = await s.post("/admin/config", { overrides: { catalog: { harborPass: { paidTrack: [{ tier: 1, silver: 9 }] } } } }, { authorization: "Bearer admin" });
    expect(bad.status).toBe(422);
    expect(s.calls.length).toBe(0);
    const good = await s.post("/admin/config", { overrides: { economy: { eggPriceSilver: 90 } } }, { authorization: "Bearer admin" });
    expect(good.status).toBe(200);
    expect(s.calls.some((c) => c.url.includes("datastoreName=LiveConfig"))).toBe(true);
    expect(s.calls.some((c) => c.url.includes("topics/tidebound-config"))).toBe(true);
    s.close();
  });

  it("queues support reversals and tells live servers", async () => {
    const s = await start();
    const res = await s.post("/admin/reverse", { userId: 5, purchaseId: "P-1", reason: "chargeback" }, { authorization: "Bearer admin" });
    expect(res.status).toBe(200);
    const set = s.calls.find((c) => c.method === "POST" && c.url.includes("PendingReversals"));
    expect(JSON.parse(set!.body!)[0].purchaseId).toBe("P-1");
    expect(s.calls.some((c) => c.url.includes("topics/tidebound-reverse"))).toBe(true);
    s.close();
  });

  it("schedules opt-in notifications and sends them when due, at most two a day", async () => {
    const s = await start();
    const now = Date.parse("2026-10-05T10:00:00Z") / 1000;
    s.setNow(now);
    const res = await s.post(
      "/v1/notifications/schedule",
      { userId: 9, candidates: [{ type: "crops_ready", at: now + 300 }], settings: { crops_ready: true, night_starting: true, worker_income_full: true, season_changed: true } },
      { authorization: "Bearer game" },
    );
    expect(((await res.json()) as any).scheduled).toBeLessThanOrEqual(4);
    s.setNow(now + 400);
    const sent = await dispatchDue(s.deps);
    expect(sent).toBe(1);
    expect(s.calls.some((c) => c.url.includes("/users/9/notifications") && c.body?.includes("notif:crops_ready"))).toBe(true);
    s.close();
  });
});
