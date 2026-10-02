import "server-only";

/** Coarse device class from the User-Agent. Good enough for funnels; not fingerprinting. */
export function deviceFromUA(ua: string | null): "mobile" | "tablet" | "desktop" {
  if (!ua) return "desktop";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Buyer country from the edge/CDN geo header, if the host sets one
 * (Vercel, Cloudflare, Fly, or a custom x-country from your proxy).
 */
export function countryFromHeaders(h: Headers): string | null {
  const raw = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? h.get("fly-client-ip-country") ?? h.get("x-country");
  return raw && /^[A-Z]{2}$/.test(raw) && raw !== "XX" ? raw : null;
}

export function clientIpFromHeaders(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
