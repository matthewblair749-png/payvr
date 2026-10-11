/**
 * Room settings in one place. Per-plan limits (room size, live minutes,
 * voice input) live in plans.ts; these apply to every room.
 */
export const ROOMS = {
  /** A room closes this long after it was created, and its messages are deleted. */
  lifetimeHours: 24,
  /** Longest message, in characters. */
  maxMessageChars: 1_000,
  /** Longest display name, in characters. */
  maxNameChars: 40,
  /** Longest room name, in characters. */
  maxRoomNameChars: 60,
  /** Messages loaded when someone (re)connects. */
  historyLimit: 200,
  /** Per person: at most `limit` messages per `windowMs`. */
  messageRate: { limit: 8, windowMs: 10_000 },
  /** Per IP: joins per minute, so nobody can flood a room with guests. */
  joinRate: { limit: 10, windowMs: 60_000 },
  /** A typing indicator disappears after this long without an update. */
  typingTimeoutMs: 6_000,
  /** How often an active room charges a minute to its owner's allowance. */
  minuteTickMs: 60_000,
  /** Open rooms one person can have at a time. */
  maxOpenRoomsPerOwner: 10,
  /** Per person: reports per 10 minutes. */
  reportRate: { limit: 5, windowMs: 10 * 60_000 },
  /** Abuse reports are deleted after this many days. */
  reportRetentionDays: 30,
} as const;

export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
