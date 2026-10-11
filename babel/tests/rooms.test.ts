import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlan } from "@/config/plans";
import { ROOMS } from "@/config/rooms";
import type { MessageView, ServerEvents } from "@/features/rooms/protocol";
import { RoomHub, type HubConnection, messageViewFor } from "@/features/rooms/server/hub";
import { createRoom, deleteFinishedRooms, joinRoom, pruneReports, RoomRuleError } from "@/features/rooms/server/rooms";
import { hashIp, newRoomId } from "@/features/rooms/server/secrets";
import type { TranslateFn } from "@/features/translation/server/translate";
import { createUser, describeDb, testDb } from "./helpers/db";

/** A connection that records what the hub sends it. */
class FakeConnection implements HubConnection {
  readonly id = randomUUID();
  readonly events: { event: keyof ServerEvents; args: unknown[] }[] = [];
  disconnected = false;
  emit<E extends keyof ServerEvents>(event: E, ...args: Parameters<ServerEvents[E]>) {
    this.events.push({ event, args });
  }
  disconnect() {
    this.disconnected = true;
  }
  last<E extends keyof ServerEvents>(event: E): Parameters<ServerEvents[E]>[0] | undefined {
    const found = [...this.events].reverse().find((e) => e.event === event);
    return found?.args[0] as Parameters<ServerEvents[E]>[0] | undefined;
  }
  all<E extends keyof ServerEvents>(event: E): Parameters<ServerEvents[E]>[0][] {
    return this.events.filter((e) => e.event === event).map((e) => e.args[0] as Parameters<ServerEvents[E]>[0]);
  }
}

describe("room ids", () => {
  it("are long, unguessable and URL-safe", () => {
    const ids = new Set(Array.from({ length: 500 }, newRoomId));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{12}$/);
  });
});

describe("messageViewFor", () => {
  const stored = { id: "m1", clientId: "c1", participantId: "p1", senderName: "Ana", text: "Hola", lang: "es", createdAt: new Date(0) };
  it("shows the reader's translation", () => {
    expect(messageViewFor(stored, "en", "Hello")).toMatchObject({ text: "Hello", lang: "en", original: "Hola", translated: true });
  });
  it("falls back to the original, flagged, when translation failed", () => {
    expect(messageViewFor(stored, "en", undefined)).toMatchObject({ text: "Hola", lang: "es", translated: false });
  });
  it("needs no translation for readers of the same language", () => {
    expect(messageViewFor(stored, "es", undefined)).toMatchObject({ text: "Hola", translated: true });
  });
});

describeDb("rooms (Postgres)", () => {
  let clock: Date;
  let translate: ReturnType<typeof vi.fn<TranslateFn>>;
  let hub: RoomHub;

  beforeEach(() => {
    clock = new Date("2026-10-11T12:00:00Z");
    translate = vi.fn<TranslateFn>(async (text, from, to) => ({ text: `[${to}] ${text}`, from: from === "auto" ? "unknown" : from, to, provider: "fake", cached: false }));
    hub = new RoomHub({ db: testDb, translate, now: () => clock });
  });

  async function openRoom(opts: { plan?: "plus" } = {}) {
    const owner = await createUser();
    if (opts.plan) {
      await testDb.subscription.create({
        data: { userId: owner.id, stripeSubscriptionId: `sub_${owner.id}`, stripeCustomerId: `cus_${owner.id}`, plan: opts.plan, interval: "monthly", status: "active", stripeEventAt: clock },
      });
    }
    const { roomId } = await createRoom(testDb, { ownerId: owner.id, name: "Test room", displayName: "Sam", language: "en" }, clock);
    const host = await joinRoom(testDb, { roomId, userId: owner.id, ip: "1.1.1.1", displayName: "Sam", language: "en" }, clock);
    return { owner, roomId, host };
  }

  async function connect(roomId: string, creds: { participantId: string; token: string }) {
    const auth = await hub.authenticate({ roomId, ...creds });
    if (!auth.ok) throw new Error(`auth failed: ${auth.reason}`);
    const conn = new FakeConnection();
    await hub.attach(conn, roomId, creds.participantId);
    return conn;
  }

  async function send(conn: FakeConnection, text: string, clientId = randomUUID()) {
    return hub.handle(conn, "message:send", { clientId, text });
  }

  /** Owner (English) and one Spanish guest, both connected. */
  async function twoPeople(opts: { plan?: "plus" } = {}) {
    const { owner, roomId, host } = await openRoom(opts);
    const guest = await joinRoom(testDb, { roomId, userId: null, ip: `10.0.0.${Math.floor(Math.random() * 250)}`, displayName: "Ana", language: "es" }, clock);
    const hostConn = await connect(roomId, host);
    const guestConn = await connect(roomId, guest);
    return { owner, roomId, host, guest, hostConn, guestConn };
  }

  describe("joining", () => {
    it("fills the room up to the owner's plan size, then says it's full", async () => {
      const { roomId } = await openRoom();
      const size = getPlan("free").limits.roomSize;
      for (let i = 1; i < size; i++) {
        await joinRoom(testDb, { roomId, userId: null, ip: `10.1.0.${i}`, displayName: `G${i}`, language: "fr" }, clock);
      }
      await expect(joinRoom(testDb, { roomId, userId: null, ip: "10.1.0.99", displayName: "Late", language: "fr" }, clock)).rejects.toMatchObject({
        code: "full",
      });
    });

    it("can't be overfilled by people joining at the same moment", async () => {
      const { roomId } = await openRoom({ plan: "plus" });
      const size = getPlan("plus").limits.roomSize;
      const attempts = await Promise.allSettled(
        Array.from({ length: size + 4 }, (_, i) =>
          joinRoom(testDb, { roomId, userId: null, ip: `10.2.0.${i}`, displayName: `G${i}`, language: "de" }, clock),
        ),
      );
      expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(size - 1); // the owner holds one seat
      expect(await testDb.roomParticipant.count({ where: { roomId, removedAt: null } })).toBe(size);
    });

    it("refuses closed and expired rooms", async () => {
      const { roomId } = await openRoom();
      const later = new Date(clock.getTime() + (ROOMS.lifetimeHours + 1) * 3_600_000);
      await expect(joinRoom(testDb, { roomId, userId: null, ip: "x", displayName: "A", language: "en" }, later)).rejects.toMatchObject({ code: "closed" });
      await expect(joinRoom(testDb, { roomId: "doesNotExist1", userId: null, ip: "x", displayName: "A", language: "en" }, clock)).rejects.toBeInstanceOf(
        RoomRuleError,
      );
    });

    it("gives the owner their seat back with a new token, signing out the old one", async () => {
      const { owner, roomId, host } = await openRoom();
      const again = await joinRoom(testDb, { roomId, userId: owner.id, ip: "1.1.1.1", displayName: "Sam", language: "en" }, clock);
      expect(again.participantId).toBe(host.participantId);
      expect(await hub.authenticate({ roomId, ...host })).toEqual({ ok: false, reason: "unauthorized" });
      expect((await hub.authenticate({ roomId, ...again })).ok).toBe(true);
    });

    it("limits how many rooms one person can have open", async () => {
      const owner = await createUser();
      for (let i = 0; i < ROOMS.maxOpenRoomsPerOwner; i++) {
        await createRoom(testDb, { ownerId: owner.id, name: `R${i}`, displayName: "S", language: "en" }, clock);
      }
      await expect(createRoom(testDb, { ownerId: owner.id, name: "One more", displayName: "S", language: "en" }, clock)).rejects.toMatchObject({
        code: "too_many_rooms",
      });
    });
  });

  describe("connecting", () => {
    it("rejects bad tokens and other rooms' credentials", async () => {
      const { roomId, host } = await openRoom();
      expect(await hub.authenticate({ roomId, participantId: host.participantId, token: "x".repeat(43) })).toEqual({ ok: false, reason: "unauthorized" });
      const other = await openRoom();
      expect(await hub.authenticate({ roomId: other.roomId, ...host })).toEqual({ ok: false, reason: "unauthorized" });
      expect(await hub.authenticate({ nonsense: true })).toEqual({ ok: false, reason: "unauthorized" });
      expect((await hub.authenticate({ roomId, ...host })).ok).toBe(true);
    });

    it("sends the room, the people in it and who's online", async () => {
      const { hostConn, guestConn } = await twoPeople();
      expect(guestConn.last("room:state")).toMatchObject({ me: { name: "Ana", language: "es", role: "guest" }, room: { roomSize: 2, voiceInput: false } });
      const presence = hostConn.last("presence");
      expect(presence?.map((p) => [p.name, p.online])).toEqual([
        ["Sam", true],
        ["Ana", true],
      ]);
    });
  });

  describe("messages", () => {
    it("translates into each reader's language and never uses the shared cache", async () => {
      const { hostConn, guestConn } = await twoPeople();
      const result = await send(hostConn, "Hello!");
      expect(result).toMatchObject({ ok: true, data: { text: "Hello!", lang: "en" } });

      const received = guestConn.last("message") as MessageView;
      expect(received).toMatchObject({ text: "[es] Hello!", lang: "es", original: "Hello!", originalLang: "en", translated: true, senderName: "Sam" });
      expect(translate).toHaveBeenCalledWith("Hello!", "en", "es", { noCache: true });
      expect(await testDb.translationCache.count({ where: { text: "[es] Hello!" } })).toBe(0);
    });

    it("sends the original, flagged, when translation fails", async () => {
      const { hostConn, guestConn } = await twoPeople();
      translate.mockRejectedValueOnce(new Error("provider down"));
      await send(hostConn, "Hello?");
      expect(guestConn.last("message")).toMatchObject({ text: "Hello?", translated: false });
    });

    it("treats a resend with the same clientId as the same message", async () => {
      const { roomId, hostConn, guestConn } = await twoPeople();
      const clientId = randomUUID();
      const first = await send(hostConn, "Only once", clientId);
      const again = await send(hostConn, "Only once", clientId);
      expect(again).toEqual(first);
      expect(await testDb.roomMessage.count({ where: { roomId } })).toBe(1);
      expect(guestConn.all("message")).toHaveLength(1);
    });

    it("enforces message length and refuses empty messages", async () => {
      const { hostConn } = await twoPeople();
      expect(await send(hostConn, "x".repeat(ROOMS.maxMessageChars + 1))).toMatchObject({ ok: false });
      expect(await send(hostConn, "   ")).toMatchObject({ ok: false });
      expect(await send(hostConn, "x".repeat(ROOMS.maxMessageChars))).toMatchObject({ ok: true });
    });

    it("rate-limits someone sending very fast", async () => {
      const { hostConn } = await twoPeople();
      for (let i = 0; i < ROOMS.messageRate.limit; i++) expect((await send(hostConn, `m${i}`)).ok).toBe(true);
      expect(await send(hostConn, "one too many")).toMatchObject({ ok: false, error: expect.stringMatching(/slow down/i) });
      clock = new Date(clock.getTime() + ROOMS.messageRate.windowMs + 1);
      expect((await send(hostConn, "later")).ok).toBe(true);
    });

    it("sends history in the reader's language when they (re)connect", async () => {
      const { roomId, guest, hostConn } = await twoPeople();
      await send(hostConn, "First");
      await send(hostConn, "Second");
      const reconnect = await connect(roomId, guest);
      expect(reconnect.last("history")?.map((m) => m.text)).toEqual(["[es] First", "[es] Second"]);
    });

    it("rejects unknown events without crashing", async () => {
      const { hostConn } = await twoPeople();
      expect(await hub.handle(hostConn, "drop:tables", {})).toMatchObject({ ok: false });
    });
  });

  describe("typing", () => {
    it("tells everyone else, not the typist", async () => {
      const { host, hostConn, guestConn } = await twoPeople();
      await hub.handle(hostConn, "typing", { typing: true });
      expect(guestConn.last("typing")).toEqual({ participantId: host.participantId, typing: true });
      expect(hostConn.last("typing")).toBeUndefined();
    });
  });

  describe("blocking", () => {
    it("hides a blocked person's messages and typing from the blocker only", async () => {
      const { host, roomId, guest, hostConn, guestConn } = await twoPeople();
      expect(await hub.handle(guestConn, "block", { participantId: host.participantId })).toMatchObject({ ok: true });
      expect(guestConn.last("blocked")).toEqual([host.participantId]);

      const before = guestConn.all("message").length;
      await send(hostConn, "Can you see this?");
      await hub.handle(hostConn, "typing", { typing: true });
      expect(guestConn.all("message")).toHaveLength(before);
      expect(guestConn.last("typing")).toBeUndefined();

      // ...but the blocked person still sees the blocker's messages.
      await send(guestConn, "I can still talk");
      expect(hostConn.last("message")).toMatchObject({ original: "I can still talk" });

      // History leaves them out too.
      const reconnect = await connect(roomId, guest);
      expect(reconnect.last("history")?.some((m) => m.original === "Can you see this?")).toBe(false);

      await hub.handle(guestConn, "unblock", { participantId: host.participantId });
      expect(guestConn.last("blocked")).toEqual([]);
    });

    it("can't block yourself", async () => {
      const { host, hostConn } = await twoPeople();
      expect(await hub.handle(hostConn, "block", { participantId: host.participantId })).toMatchObject({ ok: false });
    });
  });

  describe("reports", () => {
    it("stores a report with a copy of the message, and prunes old ones", async () => {
      const { roomId, guest, hostConn, guestConn } = await twoPeople();
      await send(guestConn, "Buy cheap watches!");
      const message = await testDb.roomMessage.findFirstOrThrow({ where: { roomId, participantId: guest.participantId } });
      expect(await hub.handle(hostConn, "report", { participantId: guest.participantId, messageId: message.id, reason: "spam" })).toMatchObject({ ok: true });
      const report = await testDb.report.findFirstOrThrow({ where: { roomId } });
      expect(report).toMatchObject({ reason: "spam", messageText: "Buy cheap watches!", reportedName: "Ana", reporterName: "Sam" });

      const later = new Date(report.createdAt.getTime() + (ROOMS.reportRetentionDays + 1) * 24 * 3_600_000);
      await pruneReports(testDb, later);
      expect(await testDb.report.findUnique({ where: { id: report.id } })).toBeNull();
    });

    it("refuses reports with no reason", async () => {
      const { guest, hostConn } = await twoPeople();
      expect(await hub.handle(hostConn, "report", { participantId: guest.participantId })).toMatchObject({ ok: false });
    });
  });

  describe("removing people", () => {
    it("lets only the host remove someone, who then can't reconnect or rejoin from the same IP", async () => {
      const { roomId, host, guest, hostConn, guestConn } = await twoPeople();
      expect(await hub.handle(guestConn, "remove", { participantId: host.participantId })).toMatchObject({ ok: false });

      expect(await hub.handle(hostConn, "remove", { participantId: guest.participantId })).toMatchObject({ ok: true });
      expect(guestConn.last("removed")).toBeUndefined(); // payload-less event
      expect(guestConn.events.some((e) => e.event === "removed")).toBe(true);
      expect(guestConn.disconnected).toBe(true);
      expect(await hub.authenticate({ roomId, ...guest })).toEqual({ ok: false, reason: "removed" });
      expect(hostConn.last("presence")?.map((p) => p.name)).toEqual(["Sam"]);

      const participant = await testDb.roomParticipant.findUniqueOrThrow({ where: { id: guest.participantId } });
      expect(participant.ipHash).toBeTruthy();
      const ban = await testDb.roomBan.findFirst({ where: { roomId } });
      expect(ban?.ipHash).toBe(participant.ipHash);
    });

    it("stores IPs only as salted hashes", () => {
      expect(hashIp("203.0.113.7")).toMatch(/^[0-9a-f]{64}$/);
      expect(hashIp("203.0.113.7")).not.toContain("203");
    });

    it("blocks a removed guest from joining again from the same IP", async () => {
      const { roomId } = await openRoom();
      const guest = await joinRoom(testDb, { roomId, userId: null, ip: "198.51.100.5", displayName: "Troll", language: "en" }, clock);
      const owner = await testDb.roomParticipant.findFirstOrThrow({ where: { roomId, role: "owner" } });
      const ownerJoin = await joinRoom(testDb, { roomId, userId: (await testDb.room.findUniqueOrThrow({ where: { id: roomId } })).ownerId, ip: "1.1.1.1", displayName: "Sam", language: "en" }, clock);
      expect(ownerJoin.participantId).toBe(owner.id);
      const hostConn = await connect(roomId, ownerJoin);
      await hub.handle(hostConn, "remove", { participantId: guest.participantId });
      await expect(joinRoom(testDb, { roomId, userId: null, ip: "198.51.100.5", displayName: "Troll 2", language: "en" }, clock)).rejects.toMatchObject({
        code: "banned",
      });
    });
  });

  describe("closing and expiry", () => {
    it("closing deletes the room and every message in it", async () => {
      const { roomId, hostConn, guestConn } = await twoPeople();
      await send(hostConn, "Goodbye");
      expect(await hub.handle(guestConn, "room:close", {})).toMatchObject({ ok: false });
      expect(await hub.handle(hostConn, "room:close", {})).toMatchObject({ ok: true });
      expect(guestConn.events.some((e) => e.event === "room:closed")).toBe(true);
      expect(guestConn.disconnected).toBe(true);
      expect(await testDb.room.findUnique({ where: { id: roomId } })).toBeNull();
      expect(await testDb.roomMessage.count({ where: { roomId } })).toBe(0);
      expect(await testDb.roomMessageTranslation.count({ where: { message: { roomId } } })).toBe(0);
    });

    it("the sweep deletes expired rooms and tells anyone still there", async () => {
      const { roomId, hostConn } = await twoPeople();
      await send(hostConn, "Still here?");
      clock = new Date(clock.getTime() + (ROOMS.lifetimeHours + 1) * 3_600_000);
      expect(await send(hostConn, "Too late")).toMatchObject({ ok: false });
      await hub.sweep();
      expect(hostConn.events.some((e) => e.event === "room:closed")).toBe(true);
      expect(await testDb.room.findUnique({ where: { id: roomId } })).toBeNull();
      expect(await deleteFinishedRooms(testDb, clock)).not.toContain(roomId);
    });
  });

  describe("live minutes", () => {
    it("charges the owner one minute per tick while two or more people are online", async () => {
      const { owner, roomId, host } = await openRoom();
      const alone = await connect(roomId, host);
      await hub.tick();
      expect(await testDb.usageEvent.count({ where: { userId: owner.id, kind: "live_minutes" } })).toBe(0);

      const guest = await joinRoom(testDb, { roomId, userId: null, ip: "10.9.9.9", displayName: "Ana", language: "es" }, clock);
      await connect(roomId, guest);
      await hub.tick();
      await hub.tick();
      expect(await testDb.usageEvent.count({ where: { userId: owner.id, kind: "live_minutes" } })).toBe(2);
      expect(alone.disconnected).toBe(false);
    });

    it("pauses messages when the month's minutes run out", async () => {
      const { owner, hostConn, guestConn } = await twoPeople();
      const allowance = getPlan("free").limits.liveMinutesPerMonth;
      await testDb.usageEvent.create({ data: { userId: owner.id, kind: "live_minutes", quantity: allowance, createdAt: clock } });
      await hub.tick();
      expect(guestConn.last("notice")).toMatchObject({ kind: "minutes_exhausted" });
      expect(await send(hostConn, "Hello?")).toMatchObject({ ok: false, error: expect.stringMatching(/live minutes/) });
    });
  });
});
