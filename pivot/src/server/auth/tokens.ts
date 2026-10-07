import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token, URL-safe. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are stored hashed, so a database leak doesn't leak usable sessions or links. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
