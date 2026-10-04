import { createHmac, timingSafeEqual } from "node:crypto";

// Verifies Roblox webhook signatures: header "roblox-signature: t=<unix>,v1=<base64 HMAC-SHA256 of `${t}.${body}`>".
export function verifyRobloxSignature(header: string | undefined, body: string, secret: string, nowSeconds: number, toleranceSeconds = 600): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!parts.t || !parts.v1 || !Number.isFinite(t) || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${body}`).digest();
  const given = Buffer.from(parts.v1, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
