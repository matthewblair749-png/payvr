import { createHash, randomBytes } from "node:crypto";

/** Unguessable room id for share links: 12 chars of base62, about 71 bits. */
export function newRoomId(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(12);
  // 256 % 62 bias is negligible at this length and for this purpose.
  return Array.from(bytes, (b) => alphabet[b % 62]).join("");
}

/** The secret a browser keeps to reconnect as the same participant. */
export function newParticipantToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Salted so the stored value can't be reversed into an IP with a lookup table. */
export function hashIp(ip: string): string {
  const salt = process.env.AUTH_SECRET ?? "babel-dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
