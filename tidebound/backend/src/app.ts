import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { Env } from "./env.js";
import { OpenCloud } from "./openCloud.js";
import { verifyRobloxSignature } from "./signature.js";
import { nextNightStart, nextSeasonStart, plan, type NotificationRules } from "./notifications.js";
import { computeKpis, type GameEvent } from "./kpi.js";
import type { Storage } from "./storage.js";

export interface Deps {
  env: Env;
  cloud: OpenCloud;
  storage: Storage;
  validateConfig: (overrides: Record<string, any>) => string[];
  notificationRules: NotificationRules;
  cycle: Parameters<typeof nextNightStart>[0];
  seasons: Parameters<typeof nextSeasonStart>[0];
  now: () => number; // unix seconds
}

const MAX_BODY = 1_000_000;
const PLAYER_STORES = ["Players", "PendingReversals"];

type Handler = (deps: Deps, body: string, req: IncomingMessage, url: URL) => Promise<[number, unknown]>;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function bearer(req: IncomingMessage): string {
  const h = req.headers.authorization ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

// Simple fixed-window rate limit per client IP and route.
const windows = new Map<string, { start: number; count: number }>();
export function rateLimited(ip: string, route: string, now: number, limit = 120): boolean {
  const key = `${ip}|${route}`;
  const w = windows.get(key);
  if (!w || now - w.start >= 60) {
    windows.set(key, { start: now, count: 1 });
    return false;
  }
  w.count++;
  return w.count > limit;
}

async function erase(deps: Deps, userId: number): Promise<void> {
  for (const store of PLAYER_STORES) await deps.cloud.deleteEntry(store, `u${userId}`);
  deps.storage.eraseUser(userId);
  // Closes a live session, which would otherwise write the save back on leave.
  await deps.cloud.publish("tidebound-erase", String(userId));
}

const game: Record<string, Handler> = {
  "/v1/events": async (deps, body) => {
    const { events } = JSON.parse(body) as { events: GameEvent[] };
    if (!Array.isArray(events) || events.length > 1000) return [400, { error: "bad_events" }];
    deps.storage.appendEvents(events.filter((e) => typeof e.name === "string" && Number.isInteger(e.userId)));
    return [200, { ok: true }];
  },
  "/v1/logs": async (deps, body) => {
    deps.storage.append("logs", JSON.parse(body));
    return [200, { ok: true }];
  },
  "/v1/reports": async (deps, body) => {
    deps.storage.append("reports", JSON.parse(body));
    return [200, { ok: true }];
  },
  "/v1/notifications/schedule": async (deps, body) => {
    const { userId, candidates, settings } = JSON.parse(body);
    if (!Number.isInteger(userId) || !Array.isArray(candidates)) return [400, { error: "bad_request" }];
    const schedule = deps.storage.readSchedule();
    const entry = schedule.users[String(userId)] ?? { pending: [], sent: {} };
    const now = deps.now();
    const all = [
      ...candidates.filter((c: any) => typeof c?.type === "string" && Number.isFinite(c?.at)),
      // A reminder for the next night that starts at least an hour from now, and the next season.
      { type: "night_starting", at: nextNightStart(deps.cycle, now + 3600) - 120 },
      { type: "season_changed", at: nextSeasonStart(deps.seasons, now) },
    ];
    entry.pending = plan(deps.notificationRules, all, settings ?? {}, entry.sent, 0);
    schedule.users[String(userId)] = entry;
    deps.storage.writeSchedule(schedule);
    return [200, { scheduled: entry.pending.length }];
  },
  "/v1/erasure/in-game": async (deps, body) => {
    const { userId } = JSON.parse(body);
    if (!Number.isInteger(userId)) return [400, { error: "bad_request" }];
    await erase(deps, userId);
    return [200, { ok: true }];
  },
};

const admin: Record<string, Handler> = {
  "/admin/config": async (deps, body) => {
    const { overrides } = JSON.parse(body);
    const errors = deps.validateConfig(overrides ?? {});
    if (errors.length) return [422, { errors }];
    await deps.cloud.setEntry("LiveConfig", "overrides", overrides);
    await deps.cloud.publish("tidebound-config", "reload");
    return [200, { ok: true }];
  },
  "/admin/reverse": async (deps, body) => {
    const { userId, purchaseId, reason } = JSON.parse(body);
    if (!Number.isInteger(userId) || typeof purchaseId !== "string") return [400, { error: "bad_request" }];
    // Queue for the next join, and tell live servers in case the player is online now.
    const key = `u${userId}`;
    const pending = ((await deps.cloud.getEntry<unknown[]>("PendingReversals", key)) ?? []) as unknown[];
    pending.push({ purchaseId, reason: reason ?? "support", at: deps.now() });
    await deps.cloud.setEntry("PendingReversals", key, pending);
    await deps.cloud.publish("tidebound-reverse", JSON.stringify({ userId, purchaseId, reason: reason ?? "support" }));
    return [200, { ok: true }];
  },
  "/admin/export": async (deps, body) => {
    const { userId } = JSON.parse(body);
    const save = await deps.cloud.getEntry("Players", `u${userId}`);
    const events = deps.storage.readEvents().filter((e) => e.userId === userId);
    return [200, { userId, save: save ?? null, events }];
  },
  "/admin/kpis": async (deps, _body, _req, url) => {
    const to = Number(url.searchParams.get("to") ?? deps.now());
    const from = Number(url.searchParams.get("from") ?? to - 30 * 86400);
    return [200, computeKpis(deps.storage.readEvents(), from, to)];
  },
};

// Roblox Right to Erasure webhook (Creator Hub > Webhooks).
async function robloxWebhook(deps: Deps, body: string, req: IncomingMessage): Promise<[number, unknown]> {
  const signature = req.headers["roblox-signature"];
  if (!verifyRobloxSignature(Array.isArray(signature) ? signature[0] : signature, body, deps.env.webhookSecret, deps.now())) {
    return [401, { error: "bad_signature" }];
  }
  const payload = JSON.parse(body);
  if (payload.NotificationType === "SampleNotification") return [200, { ok: true }];
  if (payload.NotificationType === "RightToErasureRequest") {
    const info = payload.EventPayload ?? {};
    const universes: number[] = (info.GameIds ?? []).map(Number);
    if (universes.length === 0 || universes.includes(Number(deps.env.universeId))) {
      await erase(deps, Number(info.UserId));
    }
  }
  return [200, { ok: true }];
}

export function createHandler(deps: Deps) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ?? req.socket.remoteAddress ?? "unknown";
      if (rateLimited(ip, url.pathname, deps.now())) return send(429, { error: "rate_limited" });
      if (req.method === "GET" && url.pathname === "/healthz") return send(200, { ok: true });
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > MAX_BODY) return send(413, { error: "too_large" });
      }
      if (req.method === "POST" && url.pathname === "/webhooks/roblox") {
        const [s, b] = await robloxWebhook(deps, body, req);
        return send(s, b);
      }
      const gameRoute = game[url.pathname];
      if (gameRoute && req.method === "POST") {
        if (!safeEqual(bearer(req), deps.env.gameSecret)) return send(401, { error: "unauthorized" });
        const [s, b] = await gameRoute(deps, body, req, url);
        return send(s, b);
      }
      const adminRoute = admin[url.pathname];
      if (adminRoute) {
        if (!safeEqual(bearer(req), deps.env.adminKey)) return send(401, { error: "unauthorized" });
        const [s, b] = await adminRoute(deps, body || "{}", req, url);
        return send(s, b);
      }
      return send(404, { error: "not_found" });
    } catch (err) {
      console.error(JSON.stringify({ level: "error", event: "request_failed", error: String(err) }));
      return send(err instanceof SyntaxError ? 400 : 500, { error: err instanceof SyntaxError ? "bad_json" : "internal" });
    }
  };
}

// Sends notifications that are due. Runs every minute from server.ts.
export async function dispatchDue(deps: Deps): Promise<number> {
  const schedule = deps.storage.readSchedule();
  const now = deps.now();
  let sent = 0;
  for (const [user, entry] of Object.entries(schedule.users)) {
    const due = entry.pending.filter((p) => p.at <= now);
    entry.pending = entry.pending.filter((p) => p.at > now);
    for (const n of due) {
      const messageId = deps.env.notificationMessageIds[n.type];
      if (!messageId) continue;
      await deps.cloud.notify(Number(user), messageId, `notif:${n.type}`, n.type);
      const dayKey = String(Math.floor(n.at / 86400));
      entry.sent[dayKey] = (entry.sent[dayKey] ?? 0) + 1;
      sent++;
    }
  }
  deps.storage.writeSchedule(schedule);
  return sent;
}
