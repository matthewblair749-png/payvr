/**
 * Deterministic brand → checkout theme mapping. Used on its own when no AI key
 * is configured, and as the baseline + safety net for the AI result.
 */
import { hexToRgb, luminance, mix } from "@/lib/color";
import type { FontKey } from "@/lib/checkout/meta";
import type { Theme } from "@/lib/checkout/schema";
import type { BrandSignals } from "./extract";

export type BrandGuess = {
  brandName: string;
  logoUrl: string | null;
  theme: Pick<Theme, "accent" | "background" | "mode" | "font" | "radius">;
  rationale: string;
};

/** HSL saturation (0..1) and lightness (0..1). */
export function hsl(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

const isBrandy = (hex: string) => {
  const { s, l } = hsl(hex);
  return s >= 0.35 && l >= 0.18 && l <= 0.78;
};

const FONT_RULES: [RegExp, FontKey][] = [
  [/mono|code|courier|jetbrains|plex mono|space mono/i, "plexMono"],
  [/serif|garamond|playfair|lora|merriweather|fraunces|times|georgia|baskerville|cormorant|caslon|didot|bodoni|recoleta|canela|tiempos|freight|domine|spectral/i, "fraunces"],
  [/sora|poppins|montserrat|futura|gilroy|manrope|outfit|lexend|circular|avenir|urbanist|plus jakarta|nunito|quicksand|raleway/i, "sora"],
  [/grotesk|grotesque|inter\b|helvetica|neue|archivo|work sans|aeonik|suisse|haas|akzidenz|general sans|satoshi/i, "spaceGrotesk"],
];

export function mapFont(names: string[]): FontKey {
  for (const name of names) {
    // "sans serif" families must not trip the serif rule.
    const n = name.replace(/sans[- ]?serif/i, "sans");
    for (const [re, key] of FONT_RULES) if (re.test(n)) return key;
  }
  return "dmSans";
}

export function pickRadius(radii: number[]): number {
  const usable = radii.filter((r) => r > 0 && r < 64);
  const pills = radii.filter((r) => r >= 999).length;
  if (!usable.length) return pills > 3 ? 24 : 12;
  const sorted = usable.sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.max(0, Math.min(28, Math.round(pills > usable.length ? 24 : median * 1.5)));
}

export function cleanBrandName(signals: Pick<BrandSignals, "siteName" | "title" | "url" | "isInstagram">): string {
  if (signals.isInstagram) {
    // "Name (@handle) • Instagram photos and videos"
    const m = /^(.*?)\s*\(@([\w.]+)\)/.exec(signals.title);
    if (m) return (m[1] || m[2]).trim().slice(0, 48);
    const handle = new URL(signals.url).pathname.split("/").filter(Boolean)[0];
    if (handle) return handle.slice(0, 48);
  }
  const raw = signals.siteName || signals.title.split(/\s[|–—·:-]\s/)[0] || new URL(signals.url).hostname.replace(/^www\./, "");
  return raw.trim().slice(0, 48) || "Your brand";
}

export function guessFromSignals(signals: BrandSignals): BrandGuess {
  const brandy = signals.colors.filter((c) => isBrandy(c.hex));
  const accent =
    (signals.themeColor && isBrandy(signals.themeColor) ? signals.themeColor : null) ??
    brandy[0]?.hex ??
    signals.themeColor ??
    "#F04A1A";

  // Background: a frequently-used light neutral, else a soft tint of the accent.
  const lights = signals.colors.filter((c) => luminance(c.hex) > 0.8 && c.hex !== "#FFFFFF");
  const darks = signals.colors.filter((c) => luminance(c.hex) < 0.03);
  const darkSite = darks.length > 0 && darks[0].weight > (lights[0]?.weight ?? 0) * 2 && signals.colors[0] && luminance(signals.colors[0].hex) < 0.03;
  const background = lights[0]?.hex ?? mix("#FFFFFF", accent, 0.08).toUpperCase();

  const font = mapFont([...signals.googleFonts, ...signals.fontFamilies.map((f) => f.name)]);
  const radius = pickRadius(signals.radii);

  return {
    brandName: cleanBrandName(signals),
    // Instagram CDN URLs expire, so never hotlink them as a logo.
    logoUrl: signals.isInstagram ? null : (signals.logoCandidates.find((u) => u.startsWith("https://")) ?? null),
    theme: { accent, background, mode: darkSite ? "dark" : "light", font, radius },
    rationale: signals.themeColor
      ? "Used your site's theme color and most-used styles."
      : "Picked the most prominent brand color and type from your site.",
  };
}
