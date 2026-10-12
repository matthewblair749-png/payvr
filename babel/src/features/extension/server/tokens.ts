import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/server/db";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Short description of the browser, from its user agent. Never stores the full string. */
export function browserLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : /CrOS/.test(ua) ? "ChromeOS" : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Issues a token for one browser. The plain token is returned once and never stored. */
export async function createExtensionToken(db: Db, userId: string, label: string): Promise<string> {
  const token = `bx_${randomBytes(32).toString("base64url")}`;
  await db.extensionToken.create({ data: { userId, tokenHash: hash(token), label } });
  return token;
}

/** The user an "Authorization: Bearer" token belongs to, or null. */
export async function userForToken(db: Db, authorization: string | null, now = new Date()): Promise<string | null> {
  const match = /^Bearer (bx_[\w-]{20,100})$/.exec(authorization ?? "");
  if (!match) return null;
  const row = await db.extensionToken.findUnique({ where: { tokenHash: hash(match[1]) } });
  if (!row || row.revokedAt) return null;
  // Touch at most hourly to keep requests cheap.
  if (now.getTime() - row.lastUsedAt.getTime() > 3_600_000) {
    await db.extensionToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  }
  return row.userId;
}

export async function revokeExtensionToken(db: Db, userId: string, tokenId: string): Promise<void> {
  // Scoped by userId so nobody can revoke someone else's browser.
  await db.extensionToken.updateMany({ where: { id: tokenId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
