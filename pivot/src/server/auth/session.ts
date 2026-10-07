import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE } from "@/lib/security/cookies";
import { db } from "../db";
import { hashToken, newToken } from "./tokens";

/**
 * Database sessions. The cookie holds a random token; the database holds
 * only its SHA-256. Sessions last 30 days, are deleted on logout, and all of
 * a user's sessions are revoked when their password changes.
 */
const SESSION_DAYS = 30;

export type SessionUser = { id: string; email: string; name: string; activeCompanyId: string | null };

export async function createSession(userId: string, userAgent: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt, userAgent } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Deduped per request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    select: { id: true, expiresAt: true, lastUsedAt: true, user: { select: { id: true, email: true, name: true, activeCompanyId: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  // Touch at most hourly (cheap "last active" for Settings).
  if (Date.now() - session.lastUsedAt.getTime() > 3_600_000) {
    void db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return session.user;
});

/** For pages: the signed-in user, or a redirect to /login. */
export async function requireUser(next = "/app"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
