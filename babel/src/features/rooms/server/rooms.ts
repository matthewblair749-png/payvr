import { ROOMS } from "@/config/rooms";
import { resolveEntitlement } from "@/features/billing/entitlements";
import type { LanguageCode } from "@/features/translation/languages";
import type { Db } from "@/server/db";
import { hashIp, hashToken, newParticipantToken, newRoomId } from "./secrets";

/**
 * Room lifecycle, used by the HTTP routes and the realtime hub. Plain
 * functions over the database so both sides share one set of rules.
 */

export type RoomError =
  | "not_found"
  | "closed"
  | "full"
  | "banned"
  | "too_many_rooms";

export class RoomRuleError extends Error {
  constructor(readonly code: RoomError) {
    super(code);
    this.name = "RoomRuleError";
  }
}

export function isOpen(room: { closedAt: Date | null; expiresAt: Date }, now = new Date()): boolean {
  return !room.closedAt && room.expiresAt > now;
}

export async function createRoom(
  db: Db,
  input: { ownerId: string; name: string; displayName: string; language: LanguageCode },
  now = new Date(),
): Promise<{ roomId: string }> {
  const open = await db.room.count({ where: { ownerId: input.ownerId, closedAt: null, expiresAt: { gt: now } } });
  if (open >= ROOMS.maxOpenRoomsPerOwner) throw new RoomRuleError("too_many_rooms");

  const roomId = newRoomId();
  await db.room.create({
    data: {
      id: roomId,
      ownerId: input.ownerId,
      name: input.name,
      expiresAt: new Date(now.getTime() + ROOMS.lifetimeHours * 3_600_000),
      participants: {
        create: {
          userId: input.ownerId,
          displayName: input.displayName,
          language: input.language,
          role: "owner",
          // Unusable placeholder; the owner gets a real token when they open the room.
          tokenHash: hashToken(newParticipantToken()),
        },
      },
    },
  });
  return { roomId };
}

export interface JoinResult {
  participantId: string;
  token: string;
}

/**
 * Joins a room. The signed-in owner always gets their owner seat back (with
 * a fresh token, which signs out their other devices). Guests are checked
 * against bans and the owner's room size.
 */
export async function joinRoom(
  db: Db,
  input: { roomId: string; userId: string | null; ip: string; displayName: string; language: LanguageCode },
  now = new Date(),
): Promise<JoinResult> {
  const room = await db.room.findUnique({ where: { id: input.roomId } });
  if (!room) throw new RoomRuleError("not_found");
  if (!isOpen(room, now)) throw new RoomRuleError("closed");

  const token = newParticipantToken();

  if (input.userId && input.userId === room.ownerId) {
    const owner = await db.roomParticipant.findFirstOrThrow({ where: { roomId: room.id, role: "owner" } });
    await db.roomParticipant.update({
      where: { id: owner.id },
      data: { tokenHash: hashToken(token), displayName: input.displayName, language: input.language },
    });
    return { participantId: owner.id, token };
  }

  const ipHash = hashIp(input.ip);
  const banned = await db.roomBan.findUnique({ where: { roomId_ipHash: { roomId: room.id, ipHash } } });
  if (banned) throw new RoomRuleError("banned");

  // Room size comes from the owner's plan. Checked and inserted under a lock
  // so two people joining at once can't overfill the room.
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`room:${room.id}`}))`;
    const sub = await tx.subscription.findUnique({ where: { userId: room.ownerId } });
    const roomSize = resolveEntitlement(sub, now).plan.limits.roomSize;
    const present = await tx.roomParticipant.count({ where: { roomId: room.id, removedAt: null } });
    if (present >= roomSize) throw new RoomRuleError("full");

    const participant = await tx.roomParticipant.create({
      data: {
        roomId: room.id,
        displayName: input.displayName,
        language: input.language,
        role: "guest",
        tokenHash: hashToken(token),
        ipHash,
      },
    });
    return { participantId: participant.id, token };
  });
}

/** Deletes rooms that have closed or expired, and everything in them. */
export async function deleteFinishedRooms(db: Db, now = new Date()): Promise<string[]> {
  const finished = await db.room.findMany({
    where: { OR: [{ expiresAt: { lte: now } }, { closedAt: { not: null } }] },
    select: { id: true },
  });
  if (finished.length === 0) return [];
  const ids = finished.map((r) => r.id);
  await db.room.deleteMany({ where: { id: { in: ids } } });
  return ids;
}

/** Deletes abuse reports older than the retention period. */
export async function pruneReports(db: Db, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ROOMS.reportRetentionDays * 24 * 3_600_000);
  const { count } = await db.report.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
