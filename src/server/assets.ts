import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { UserError } from "./errors";
import { safeFetch } from "./brand-import/safe-fetch";

/**
 * Merchant images hosted by lumen. Logos are copied in at publish time, so a
 * live checkout only ever loads same-origin images: buyers' browsers don't
 * call the merchant's host, and the logo can't change or 404 under a sale.
 */

export const MAX_ASSET_BYTES = 512 * 1024;
const ASSET_PATH = /^\/assets\/([a-z0-9]{20,32})$/;

/** Detect the real image type from the bytes; the server's content-type is only a hint. */
export function sniffImage(body: Buffer): string | null {
  if (body.length < 4) return null;
  if (body[0] === 0x89 && body.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  if (body.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (body.subarray(0, 4).toString("latin1") === "RIFF" && body.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (body[0] === 0 && body[1] === 0 && body[2] === 1 && body[3] === 0) return "image/x-icon";
  const head = body.subarray(0, 1024).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    // Served sandboxed and only shown via <img> (where scripts never run), but
    // there's no reason to keep a logo that carries script or event handlers.
    const text = body.toString("utf8");
    if (/<script|\son[a-z]+\s*=|javascript:|<foreignObject/i.test(text)) return null;
    return "image/svg+xml";
  }
  return null;
}

/** Store bytes for a merchant (deduplicated by hash) and return the public path. */
export async function storeAsset(merchantId: string, body: Buffer, sourceUrl?: string): Promise<string> {
  if (body.length > MAX_ASSET_BYTES) throw new UserError("That image is over 512 KB");
  const contentType = sniffImage(body);
  if (!contentType) throw new UserError("That isn't a supported image (PNG, JPEG, GIF, WebP, ICO or SVG)");
  const sha256 = createHash("sha256").update(body).digest("hex");
  const asset = await db.asset.upsert({
    where: { merchantId_sha256: { merchantId, sha256 } },
    create: { merchantId, sha256, contentType, bytes: new Uint8Array(body), sourceUrl: sourceUrl?.slice(0, 500) },
    update: {},
    select: { id: true },
  });
  return `/assets/${asset.id}`;
}

/**
 * Return a lumen-hosted path for a logo. Already-hosted paths must belong to
 * this merchant; remote URLs are fetched through the SSRF-hardened client.
 */
export async function hostLogo(merchantId: string, logoUrl: string): Promise<string> {
  const own = ASSET_PATH.exec(logoUrl);
  if (own) {
    const found = await db.asset.findFirst({ where: { id: own[1], merchantId }, select: { id: true } });
    if (!found) throw new UserError("That logo isn't available");
    return logoUrl;
  }
  // Republishing an unchanged draft reuses the copy instead of re-downloading.
  const copied = await db.asset.findFirst({ where: { merchantId, sourceUrl: logoUrl }, select: { id: true }, orderBy: { createdAt: "desc" } });
  if (copied) return `/assets/${copied.id}`;
  const res = await safeFetch(logoUrl, { maxBytes: MAX_ASSET_BYTES, accept: /^(image\/|application\/octet-stream|$)/ });
  return storeAsset(merchantId, res.body, logoUrl);
}

export async function getAsset(id: string) {
  if (!/^[a-z0-9]{20,32}$/.test(id)) return null;
  return db.asset.findUnique({ where: { id }, select: { contentType: true, bytes: true, sha256: true } });
}
