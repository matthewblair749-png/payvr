import { z } from "zod";
import { REPORT_REASONS, ROOMS } from "@/config/rooms";
import { LANGUAGE_CODES, type LanguageCode } from "@/features/translation/languages";

/**
 * The realtime protocol, shared by the browser and the room server. Every
 * payload a client sends is validated with these schemas on the server.
 */

// ----- Client to server -----------------------------------------------------

export const sendMessageSchema = z.object({
  /** Random id from the browser; resending the same one never duplicates. */
  clientId: z.string().min(8).max(64).regex(/^[\w-]+$/),
  text: z
    .string()
    .trim()
    .min(1, "Write something first.")
    .max(ROOMS.maxMessageChars, `Messages can be up to ${ROOMS.maxMessageChars.toLocaleString("en-US")} characters.`),
});
export const typingSchema = z.object({ typing: z.boolean() });
export const participantTargetSchema = z.object({ participantId: z.string().min(1).max(64) });
export const reportSchema = participantTargetSchema.extend({
  messageId: z.string().min(1).max(64).optional(),
  reason: z.enum(REPORT_REASONS),
});

export const joinSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Tell people what to call you.")
    .max(ROOMS.maxNameChars, `Names can be up to ${ROOMS.maxNameChars} characters.`)
    // No control characters or zero-width tricks in names.
    .refine((v) => !/[\p{Cc}\p{Cf}]/u.test(v), "That name has characters we can't show."),
  language: z.enum(LANGUAGE_CODES),
});

export const createRoomSchema = joinSchema.extend({
  name: z.string().trim().min(1, "Give your room a name.").max(ROOMS.maxRoomNameChars),
});

// ----- Server to client -----------------------------------------------------

export interface ParticipantView {
  id: string;
  name: string;
  language: LanguageCode;
  role: "owner" | "guest";
  online: boolean;
}

export interface MessageView {
  id: string;
  clientId: string;
  senderId: string;
  senderName: string;
  /** What the sender wrote, in their language. */
  original: string;
  originalLang: LanguageCode;
  /** What this reader sees: the translation, or the original if it couldn't be translated. */
  text: string;
  lang: LanguageCode;
  /** False when the translation failed and `text` is the original. */
  translated: boolean;
  createdAt: string;
}

export interface RoomStateView {
  room: { id: string; name: string; expiresAt: string; roomSize: number; voiceInput: boolean };
  me: { id: string; name: string; language: LanguageCode; role: "owner" | "guest" };
  participants: ParticipantView[];
  blocked: string[];
}

export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type NoticeKind = "minutes_exhausted";

/** Events the server sends. */
export interface ServerEvents {
  "room:state": (state: RoomStateView) => void;
  history: (messages: MessageView[]) => void;
  message: (message: MessageView) => void;
  presence: (participants: ParticipantView[]) => void;
  typing: (payload: { participantId: string; typing: boolean }) => void;
  blocked: (blocked: string[]) => void;
  notice: (payload: { kind: NoticeKind; message: string }) => void;
  removed: () => void;
  "room:closed": () => void;
}

/** Events the client sends, each with an acknowledgement callback. */
export interface ClientEvents {
  "message:send": (payload: unknown, ack: (result: Ack<MessageView>) => void) => void;
  typing: (payload: unknown) => void;
  report: (payload: unknown, ack: (result: Ack) => void) => void;
  block: (payload: unknown, ack: (result: Ack) => void) => void;
  unblock: (payload: unknown, ack: (result: Ack) => void) => void;
  remove: (payload: unknown, ack: (result: Ack) => void) => void;
  "room:close": (payload: unknown, ack: (result: Ack) => void) => void;
}

/** What the browser presents when connecting. */
export const connectAuthSchema = z.object({
  roomId: z.string().min(1).max(64),
  participantId: z.string().min(1).max(64),
  token: z.string().min(20).max(128),
});
export type ConnectAuth = z.infer<typeof connectAuthSchema>;
