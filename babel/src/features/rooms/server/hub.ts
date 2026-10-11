import { ROOMS } from "@/config/rooms";
import { Prisma } from "@/generated/prisma/client";
import { isLanguageCode, type LanguageCode } from "@/features/translation/languages";
import { RateLimiter } from "@/features/translation/server/rate-limit";
import type { TranslateFn } from "@/features/translation/server/translate";
import { getEntitlement, reserveUsage } from "@/features/usage/server";
import type { Db } from "@/server/db";
import {
  connectAuthSchema,
  participantTargetSchema,
  reportSchema,
  sendMessageSchema,
  typingSchema,
  type Ack,
  type MessageView,
  type ParticipantView,
  type ServerEvents,
} from "../protocol";
import { deleteFinishedRooms, isOpen, pruneReports } from "./rooms";
import { hashToken } from "./secrets";

/**
 * The room hub: all realtime room behaviour, independent of the transport.
 * A transport adapter (socketio.ts) turns sockets into HubConnections and
 * forwards events to `handle`. Swapping Socket.IO for a managed service
 * means writing another adapter, not touching this file.
 *
 * State that must survive restarts lives in Postgres. In memory: who is
 * online, rate limits, and whether a room has run out of live minutes.
 * One hub instance serves all rooms; scaling past one process needs sticky
 * routing by room id.
 */

export interface HubConnection {
  readonly id: string;
  emit<E extends keyof ServerEvents>(event: E, ...args: Parameters<ServerEvents[E]>): void;
  disconnect(): void;
}

export interface HubDeps {
  db: Db;
  translate: TranslateFn;
  now?: () => Date;
}

export type AuthResult =
  | { ok: true; roomId: string; participantId: string }
  | { ok: false; reason: "unauthorized" | "closed" | "removed" };

interface LiveRoom {
  id: string;
  ownerId: string;
  expiresAt: Date;
  /** participantId → that person's open connections (tabs, devices). */
  online: Map<string, Set<HubConnection>>;
  /** The owner's live minutes ran out this month. */
  outOfMinutes: boolean;
}

interface Session {
  roomId: string;
  participantId: string;
}

type Handler = (session: Session, conn: HubConnection, payload: unknown) => Promise<Ack<unknown>>;

const MESSAGE_SELECT = {
  id: true,
  clientId: true,
  participantId: true,
  senderName: true,
  text: true,
  lang: true,
  createdAt: true,
} as const;

type StoredMessage = Prisma.RoomMessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

const ok = <T>(data: T): Ack<T> => ({ ok: true, data });
const fail = (error: string): Ack<never> => ({ ok: false, error });

function lang(code: string): LanguageCode {
  return isLanguageCode(code) ? code : "en";
}

/** The version of a message one reader sees. */
export function messageViewFor(message: StoredMessage, readerLang: LanguageCode, translation: string | undefined): MessageView {
  const sameLanguage = message.lang === readerLang;
  const text = sameLanguage ? message.text : (translation ?? message.text);
  return {
    id: message.id,
    clientId: message.clientId,
    senderId: message.participantId,
    senderName: message.senderName,
    original: message.text,
    originalLang: lang(message.lang),
    text,
    lang: sameLanguage || translation !== undefined ? readerLang : lang(message.lang),
    translated: sameLanguage || translation !== undefined,
    createdAt: message.createdAt.toISOString(),
  };
}

export class RoomHub {
  private readonly rooms = new Map<string, LiveRoom>();
  private readonly sessions = new Map<string, Session>();
  private readonly messageLimiter = new RateLimiter(ROOMS.messageRate.limit, ROOMS.messageRate.windowMs, () => this.now().getTime());
  private readonly typingLimiter = new RateLimiter(20, 10_000, () => this.now().getTime());
  private readonly reportLimiter = new RateLimiter(ROOMS.reportRate.limit, ROOMS.reportRate.windowMs, () => this.now().getTime());

  constructor(private readonly deps: HubDeps) {}

  private get db() {
    return this.deps.db;
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  // ----- Connecting ---------------------------------------------------------

  /** Checks the credentials a browser presents before it may connect. */
  async authenticate(auth: unknown): Promise<AuthResult> {
    const parsed = connectAuthSchema.safeParse(auth);
    if (!parsed.success) return { ok: false, reason: "unauthorized" };
    const { roomId, participantId, token } = parsed.data;

    const participant = await this.db.roomParticipant.findUnique({ where: { id: participantId }, include: { room: true } });
    if (!participant || participant.roomId !== roomId || participant.tokenHash !== hashToken(token)) {
      return { ok: false, reason: "unauthorized" };
    }
    if (participant.removedAt) return { ok: false, reason: "removed" };
    if (!isOpen(participant.room, this.now())) return { ok: false, reason: "closed" };
    return { ok: true, roomId, participantId };
  }

  /** Registers an authenticated connection and sends it the room. */
  async attach(conn: HubConnection, roomId: string, participantId: string): Promise<void> {
    let live = this.rooms.get(roomId);
    if (!live) {
      const room = await this.db.room.findUniqueOrThrow({ where: { id: roomId } });
      live = { id: room.id, ownerId: room.ownerId, expiresAt: room.expiresAt, online: new Map(), outOfMinutes: false };
      this.rooms.set(roomId, live);
    }
    this.sessions.set(conn.id, { roomId, participantId });
    const conns = live.online.get(participantId) ?? new Set();
    conns.add(conn);
    live.online.set(participantId, conns);

    await this.db.roomParticipant.update({ where: { id: participantId }, data: { lastSeenAt: this.now() } });
    await this.sendState(conn, live, participantId);
    await this.sendHistory(conn, roomId, participantId);
    await this.broadcastPresence(live);
  }

  async detach(conn: HubConnection): Promise<void> {
    const session = this.sessions.get(conn.id);
    if (!session) return;
    this.sessions.delete(conn.id);
    const live = this.rooms.get(session.roomId);
    if (!live) return;
    const conns = live.online.get(session.participantId);
    conns?.delete(conn);
    if (conns && conns.size === 0) {
      live.online.delete(session.participantId);
      // They may have closed the tab mid-sentence.
      this.emitToOthers(live, session.participantId, "typing", { participantId: session.participantId, typing: false });
    }
    if (live.online.size === 0) {
      this.rooms.delete(live.id);
      return;
    }
    await this.broadcastPresence(live);
  }

  // ----- Events -------------------------------------------------------------

  private readonly handlers: Record<string, Handler> = {
    "message:send": (s, c, p) => this.sendMessage(s, p),
    typing: (s, c, p) => this.typing(s, p),
    report: (s, c, p) => this.report(s, p),
    block: (s, c, p) => this.setBlock(s, p, true),
    unblock: (s, c, p) => this.setBlock(s, p, false),
    remove: (s, c, p) => this.remove(s, p),
    "room:close": (s) => this.close(s),
  };

  /** Routes one client event. Never throws: errors become a failed Ack. */
  async handle(conn: HubConnection, event: string, payload: unknown): Promise<Ack<unknown>> {
    const session = this.sessions.get(conn.id);
    const handler = this.handlers[event];
    if (!session || !handler) return fail("That isn't something rooms can do.");
    try {
      return await handler(session, conn, payload);
    } catch (error) {
      console.error(`room event ${event} failed:`, error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
      return fail("Something went wrong. Please try again.");
    }
  }

  private async sendMessage(session: Session, payload: unknown): Promise<Ack<MessageView>> {
    const parsed = sendMessageSchema.safeParse(payload);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That message didn't come through right.");

    const live = this.rooms.get(session.roomId);
    if (!live || live.expiresAt <= this.now()) return fail("This room has closed.");
    if (live.outOfMinutes) return fail("This room has used up this month's live minutes.");

    const sender = await this.db.roomParticipant.findUniqueOrThrow({ where: { id: session.participantId } });
    if (sender.removedAt) return fail("You're no longer in this room.");
    const senderLang = lang(sender.language);

    // A resend after a reconnect: hand back what we already have.
    const existing = await this.db.roomMessage.findUnique({
      where: { roomId_clientId: { roomId: session.roomId, clientId: parsed.data.clientId } },
      select: MESSAGE_SELECT,
    });
    if (existing) return ok(messageViewFor(existing, senderLang, undefined));

    if (this.messageLimiter.check(session.participantId) > 0) return fail("Slow down a little: you're sending messages very fast.");

    let message: StoredMessage;
    try {
      message = await this.db.roomMessage.create({
        data: {
          roomId: session.roomId,
          participantId: sender.id,
          senderName: sender.displayName,
          text: parsed.data.text,
          lang: senderLang,
          clientId: parsed.data.clientId,
          createdAt: this.now(),
        },
        select: MESSAGE_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const dup = await this.db.roomMessage.findUniqueOrThrow({
          where: { roomId_clientId: { roomId: session.roomId, clientId: parsed.data.clientId } },
          select: MESSAGE_SELECT,
        });
        return ok(messageViewFor(dup, senderLang, undefined));
      }
      throw error;
    }

    // Translate into every language someone online reads, in parallel.
    const readers = await this.db.roomParticipant.findMany({
      where: { id: { in: [...live.online.keys()] }, removedAt: null },
      select: { id: true, language: true },
    });
    const targets = [...new Set(readers.map((r) => lang(r.language)))].filter((l) => l !== senderLang);
    const translations = await this.translateInto(message, targets);

    const blockedBy = await this.blockersOf(session.roomId, sender.id);
    for (const reader of readers) {
      if (blockedBy.has(reader.id)) continue;
      const readerLang = lang(reader.language);
      this.emitToParticipant(live, reader.id, "message", messageViewFor(message, readerLang, translations.get(readerLang)));
    }
    return ok(messageViewFor(message, senderLang, undefined));
  }

  private async typing(session: Session, payload: unknown): Promise<Ack<undefined>> {
    const parsed = typingSchema.safeParse(payload);
    if (!parsed.success) return fail("Bad typing update.");
    if (this.typingLimiter.check(session.participantId) > 0) return ok(undefined);
    const live = this.rooms.get(session.roomId);
    if (!live) return ok(undefined);
    const blockedBy = await this.blockersOf(session.roomId, session.participantId);
    for (const pid of live.online.keys()) {
      if (pid === session.participantId || blockedBy.has(pid)) continue;
      this.emitToParticipant(live, pid, "typing", { participantId: session.participantId, typing: parsed.data.typing });
    }
    return ok(undefined);
  }

  private async report(session: Session, payload: unknown): Promise<Ack<undefined>> {
    const parsed = reportSchema.safeParse(payload);
    if (!parsed.success) return fail("Pick a reason for the report.");
    if (this.reportLimiter.check(session.participantId) > 0) return fail("You've sent a lot of reports. Please wait a few minutes.");

    const [reporter, reported] = await Promise.all([
      this.db.roomParticipant.findUniqueOrThrow({ where: { id: session.participantId } }),
      this.db.roomParticipant.findUnique({ where: { id: parsed.data.participantId } }),
    ]);
    if (!reported || reported.roomId !== session.roomId || reported.id === reporter.id) return fail("That person isn't in this room.");

    let messageText: string | null = null;
    if (parsed.data.messageId) {
      const message = await this.db.roomMessage.findUnique({ where: { id: parsed.data.messageId } });
      if (message && message.roomId === session.roomId && message.participantId === reported.id) messageText = message.text;
    }
    await this.db.report.create({
      data: {
        roomId: session.roomId,
        reporterName: reporter.displayName,
        reportedParticipantId: reported.id,
        reportedName: reported.displayName,
        messageText,
        reason: parsed.data.reason,
      },
    });
    return ok(undefined);
  }

  private async setBlock(session: Session, payload: unknown, block: boolean): Promise<Ack<undefined>> {
    const parsed = participantTargetSchema.safeParse(payload);
    if (!parsed.success) return fail("Who should be blocked?");
    const target = await this.db.roomParticipant.findUnique({ where: { id: parsed.data.participantId } });
    if (!target || target.roomId !== session.roomId || target.id === session.participantId) return fail("That person isn't in this room.");

    const key = { blockerId: session.participantId, blockedId: target.id };
    if (block) {
      await this.db.roomBlock.upsert({ where: { blockerId_blockedId: key }, create: { roomId: session.roomId, ...key }, update: {} });
    } else {
      await this.db.roomBlock.deleteMany({ where: key });
    }
    const live = this.rooms.get(session.roomId);
    if (live) this.emitToParticipant(live, session.participantId, "blocked", await this.blockedBy(session.participantId));
    return ok(undefined);
  }

  private async remove(session: Session, payload: unknown): Promise<Ack<undefined>> {
    const parsed = participantTargetSchema.safeParse(payload);
    if (!parsed.success) return fail("Who should be removed?");
    const me = await this.db.roomParticipant.findUniqueOrThrow({ where: { id: session.participantId } });
    if (me.role !== "owner") return fail("Only the host can remove people.");
    const target = await this.db.roomParticipant.findUnique({ where: { id: parsed.data.participantId } });
    if (!target || target.roomId !== session.roomId || target.role === "owner") return fail("That person isn't in this room.");

    await this.db.roomParticipant.update({ where: { id: target.id }, data: { removedAt: this.now() } });
    if (target.ipHash) {
      await this.db.roomBan.createMany({ data: [{ roomId: session.roomId, ipHash: target.ipHash }], skipDuplicates: true });
    }

    const live = this.rooms.get(session.roomId);
    if (live) {
      const conns = [...(live.online.get(target.id) ?? [])];
      for (const conn of conns) {
        conn.emit("removed");
        this.sessions.delete(conn.id);
        conn.disconnect();
      }
      live.online.delete(target.id);
      await this.broadcastPresence(live);
    }
    return ok(undefined);
  }

  private async close(session: Session): Promise<Ack<undefined>> {
    const me = await this.db.roomParticipant.findUniqueOrThrow({ where: { id: session.participantId } });
    if (me.role !== "owner") return fail("Only the host can close the room.");
    this.endRoom(session.roomId);
    // Closing deletes the room and, through cascades, every message in it.
    await this.db.room.deleteMany({ where: { id: session.roomId } });
    return ok(undefined);
  }

  // ----- Timers -------------------------------------------------------------

  /**
   * Runs once a minute. A room with two or more people online uses one
   * minute of its owner's monthly allowance; when that runs out the room
   * stops accepting messages until next month or an upgrade.
   */
  async tick(): Promise<void> {
    const now = this.now();
    for (const live of this.rooms.values()) {
      if (live.online.size < 2) continue;
      const result = await reserveUsage(this.db, live.ownerId, "live_minutes", 1, now);
      if (!result.ok && !live.outOfMinutes) {
        live.outOfMinutes = true;
        this.emitToAll(live, "notice", {
          kind: "minutes_exhausted",
          message: "This room has used up this month's live minutes, so new messages are paused. The host can upgrade to keep talking.",
        });
      } else if (result.ok) {
        live.outOfMinutes = false;
      }
    }
  }

  /** Deletes closed and expired rooms, telling anyone still connected. */
  async sweep(): Promise<void> {
    const now = this.now();
    for (const live of [...this.rooms.values()]) if (live.expiresAt <= now) this.endRoom(live.id);
    const deleted = await deleteFinishedRooms(this.db, now);
    for (const id of deleted) this.endRoom(id);
    await pruneReports(this.db, now);
  }

  // ----- Helpers ------------------------------------------------------------

  private endRoom(roomId: string): void {
    const live = this.rooms.get(roomId);
    if (!live) return;
    for (const conns of live.online.values()) {
      for (const conn of conns) {
        conn.emit("room:closed");
        this.sessions.delete(conn.id);
        conn.disconnect();
      }
    }
    this.rooms.delete(roomId);
  }

  private async translateInto(message: StoredMessage, targets: LanguageCode[]): Promise<Map<LanguageCode, string>> {
    const results = new Map<LanguageCode, string>();
    if (targets.length === 0) return results;
    await Promise.all(
      targets.map(async (to) => {
        try {
          // noCache: private messages never go into the shared cache.
          const result = await this.deps.translate(message.text, lang(message.lang), to, { noCache: true });
          results.set(to, result.text);
        } catch {
          // Readers get the original with a note instead.
        }
      }),
    );
    if (results.size > 0) {
      await this.db.roomMessageTranslation.createMany({
        data: [...results].map(([l, text]) => ({ messageId: message.id, lang: l, text })),
        skipDuplicates: true,
      });
    }
    return results;
  }

  private async sendState(conn: HubConnection, live: LiveRoom, participantId: string): Promise<void> {
    const [room, me, entitlement] = await Promise.all([
      this.db.room.findUniqueOrThrow({ where: { id: live.id } }),
      this.db.roomParticipant.findUniqueOrThrow({ where: { id: participantId } }),
      getEntitlement(this.db, live.ownerId, this.now()),
    ]);
    conn.emit("room:state", {
      room: {
        id: room.id,
        name: room.name,
        expiresAt: room.expiresAt.toISOString(),
        roomSize: entitlement.plan.limits.roomSize,
        voiceInput: entitlement.plan.features.voiceInput,
      },
      me: { id: me.id, name: me.displayName, language: lang(me.language), role: me.role === "owner" ? "owner" : "guest" },
      participants: await this.participantViews(live),
      blocked: await this.blockedBy(participantId),
    });
    if (live.outOfMinutes) {
      conn.emit("notice", { kind: "minutes_exhausted", message: "This room has used up this month's live minutes, so new messages are paused." });
    }
  }

  /** Recent messages in the reader's language, translating any gaps. */
  private async sendHistory(conn: HubConnection, roomId: string, participantId: string): Promise<void> {
    const reader = await this.db.roomParticipant.findUniqueOrThrow({ where: { id: participantId } });
    const readerLang = lang(reader.language);
    const blocked = new Set(await this.blockedBy(participantId));

    const rows = await this.db.roomMessage.findMany({
      where: { roomId },
      // id breaks ties: cuids sort in creation order within the same millisecond.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: ROOMS.historyLimit,
      select: { ...MESSAGE_SELECT, translations: { where: { lang: readerLang }, select: { text: true } } },
    });
    const messages = rows.reverse().filter((m) => !blocked.has(m.participantId));

    const views: MessageView[] = [];
    // Fill missing translations a few at a time to keep the provider happy.
    for (let i = 0; i < messages.length; i += 4) {
      const batch = messages.slice(i, i + 4);
      const filled = await Promise.all(
        batch.map(async (m) => {
          let translation: string | undefined = m.translations[0]?.text;
          if (!translation && m.lang !== readerLang) translation = (await this.translateInto(m, [readerLang])).get(readerLang);
          return messageViewFor(m, readerLang, translation);
        }),
      );
      views.push(...filled);
    }
    conn.emit("history", views);
  }

  private async participantViews(live: LiveRoom): Promise<ParticipantView[]> {
    const people = await this.db.roomParticipant.findMany({
      where: { roomId: live.id, removedAt: null },
      orderBy: { joinedAt: "asc" },
    });
    return people.map((p) => ({
      id: p.id,
      name: p.displayName,
      language: lang(p.language),
      role: p.role === "owner" ? "owner" : "guest",
      online: live.online.has(p.id),
    }));
  }

  private async broadcastPresence(live: LiveRoom): Promise<void> {
    this.emitToAll(live, "presence", await this.participantViews(live));
  }

  /** Ids of the people this participant has blocked. */
  private async blockedBy(participantId: string): Promise<string[]> {
    const rows = await this.db.roomBlock.findMany({ where: { blockerId: participantId }, select: { blockedId: true } });
    return rows.map((r) => r.blockedId);
  }

  /** Ids of the people who have blocked this participant. */
  private async blockersOf(roomId: string, participantId: string): Promise<Set<string>> {
    const rows = await this.db.roomBlock.findMany({ where: { roomId, blockedId: participantId }, select: { blockerId: true } });
    return new Set(rows.map((r) => r.blockerId));
  }

  private emitToParticipant<E extends keyof ServerEvents>(live: LiveRoom, participantId: string, event: E, ...args: Parameters<ServerEvents[E]>) {
    for (const conn of live.online.get(participantId) ?? []) conn.emit(event, ...args);
  }

  private emitToOthers<E extends keyof ServerEvents>(live: LiveRoom, except: string, event: E, ...args: Parameters<ServerEvents[E]>) {
    for (const pid of live.online.keys()) if (pid !== except) this.emitToParticipant(live, pid, event, ...args);
  }

  private emitToAll<E extends keyof ServerEvents>(live: LiveRoom, event: E, ...args: Parameters<ServerEvents[E]>) {
    for (const pid of live.online.keys()) this.emitToParticipant(live, pid, event, ...args);
  }

  /** For tests and health checks. */
  stats(): { rooms: number; connections: number } {
    return { rooms: this.rooms.size, connections: this.sessions.size };
  }
}
