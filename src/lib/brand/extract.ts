/**
 * Pulls brand "signals" out of a web page: name, theme color, logo candidates,
 * color frequencies, font families and corner radii. Pure functions over
 * strings so they're easy to unit test; fetching lives in server/brand-import.
 */
import { parse, type HTMLElement } from "node-html-parser";
import { hexToRgb, rgbToHex } from "@/lib/color";

export type ColorCount = { hex: string; count: number; weight: number };

export type BrandSignals = {
  url: string;
  title: string;
  siteName: string | null;
  description: string | null;
  themeColor: string | null;
  logoCandidates: string[];
  ogImage: string | null;
  stylesheetUrls: string[];
  googleFonts: string[];
  fontFamilies: { name: string; count: number }[];
  colors: ColorCount[];
  radii: number[];
  isInstagram: boolean;
};

const HEX = /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi;
const RGB = /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)/gi;
const BRAND_VAR = /--[\w-]*(primary|brand|accent|main|theme|highlight|cta)[\w-]*\s*:\s*([^;}{]+)/gi;
const FONT_FAMILY = /font-family\s*:\s*([^;}{]+)/gi;
const RADIUS = /border-radius\s*:\s*([^;}{]+)/gi;

const GENERIC_FONTS = new Set([
  "inherit", "initial", "unset", "sans-serif", "serif", "monospace", "system-ui", "-apple-system",
  "blinkmacsystemfont", "ui-sans-serif", "ui-serif", "ui-monospace", "cursive", "fantasy", "emoji",
  "segoe ui", "roboto", "helvetica neue", "arial", "helvetica", "apple color emoji", "segoe ui emoji",
  "segoe ui symbol", "noto color emoji", "var", "revert",
]);

function normHex(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  return rgbToHex(hexToRgb(`#${m[1]}`)).toUpperCase();
}

/** Parse any CSS color token we understand into #RRGGBB (ignores transparent ones). */
export function parseCssColor(raw: string): string | null {
  const s = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) return normHex(s);
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+)(%?))?\s*\)$/i.exec(s);
  if (rgb) {
    const alpha = rgb[4] ? Number(rgb[4]) / (rgb[5] ? 100 : 1) : 1;
    if (alpha < 0.5) return null;
    return rgbToHex({ r: +rgb[1], g: +rgb[2], b: +rgb[3] }).toUpperCase();
  }
  return null;
}

/** Count colors in CSS text. Brand-named custom properties weigh 8x. */
export function collectColors(css: string, into = new Map<string, ColorCount>()) {
  const bump = (hex: string | null, w: number) => {
    if (!hex) return;
    const c = into.get(hex) ?? { hex, count: 0, weight: 0 };
    c.count += 1;
    c.weight += w;
    into.set(hex, c);
  };
  for (const m of css.matchAll(HEX)) bump(normHex(m[0]), 1);
  for (const m of css.matchAll(RGB)) bump(parseCssColor(m[0]), 1);
  for (const m of css.matchAll(BRAND_VAR)) {
    const value = m[2].trim();
    const first = value.match(HEX)?.[0] ?? value.match(RGB)?.[0];
    if (first) bump(parseCssColor(first), 8);
  }
  return into;
}

export function collectFonts(css: string, into = new Map<string, number>()) {
  for (const m of css.matchAll(FONT_FAMILY)) {
    const first = m[1].split(",")[0].trim().replace(/^['"]|['"]$/g, "").trim();
    const key = first.toLowerCase();
    if (!first || GENERIC_FONTS.has(key) || first.startsWith("var(") || first.length > 40) continue;
    into.set(first, (into.get(first) ?? 0) + 1);
  }
  return into;
}

export function collectRadii(css: string, into: number[] = []) {
  for (const m of css.matchAll(RADIUS)) {
    const v = m[1].trim().split(/\s+/)[0];
    const px = /^([\d.]+)px$/.exec(v);
    const rem = /^([\d.]+)r?em$/.exec(v);
    if (px) into.push(Number(px[1]));
    else if (rem) into.push(Number(rem[1]) * 16);
    else if (v === "50%" || v === "9999px") into.push(999);
    if (into.length > 500) break;
  }
  return into;
}

function abs(href: string | undefined, base: URL): string | null {
  if (!href) return null;
  try {
    const u = new URL(href.trim(), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const meta = (root: HTMLElement, sel: string) => root.querySelector(sel)?.getAttribute("content")?.trim() || null;

/** Extract signals from HTML. `extraCss` = fetched external stylesheets. */
export function extractSignals(html: string, pageUrl: string, extraCss: string[] = []): BrandSignals {
  const base = new URL(pageUrl);
  const root = parse(html, { blockTextElements: { script: false, noscript: false, style: true } });

  const title = root.querySelector("title")?.text.trim() ?? "";
  const siteName = meta(root, 'meta[property="og:site_name"]') ?? meta(root, 'meta[name="application-name"]');
  const description = meta(root, 'meta[name="description"]') ?? meta(root, 'meta[property="og:description"]');
  const themeColor = parseCssColor(meta(root, 'meta[name="theme-color"]') ?? "") ?? null;
  const ogImage = abs(meta(root, 'meta[property="og:image"]') ?? undefined, base);

  // Logo candidates, best first: apple-touch-icon (square, large) > <img> with "logo" > icons > og:image
  const logos: string[] = [];
  for (const l of root.querySelectorAll('link[rel~="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')) {
    const u = abs(l.getAttribute("href"), base);
    if (u) logos.push(u);
  }
  for (const img of root.querySelectorAll("img")) {
    const hay = `${img.getAttribute("class") ?? ""} ${img.getAttribute("id") ?? ""} ${img.getAttribute("alt") ?? ""} ${img.getAttribute("src") ?? ""}`;
    if (/logo/i.test(hay)) {
      const u = abs(img.getAttribute("src"), base);
      if (u && !u.startsWith("data:")) logos.push(u);
    }
    if (logos.length > 6) break;
  }
  const icons = root
    .querySelectorAll('link[rel~="icon"]')
    .map((l) => ({ href: abs(l.getAttribute("href"), base), size: parseInt(l.getAttribute("sizes") ?? "0", 10) || 0 }))
    .filter((i): i is { href: string; size: number } => !!i.href)
    .sort((a, b) => b.size - a.size);
  logos.push(...icons.map((i) => i.href));

  const stylesheetUrls = root
    .querySelectorAll('link[rel~="stylesheet"]')
    .map((l) => abs(l.getAttribute("href"), base))
    .filter((u): u is string => !!u);

  const googleFonts = new Set<string>();
  for (const href of stylesheetUrls) {
    const u = new URL(href);
    if (u.hostname === "fonts.googleapis.com") {
      for (const fam of u.searchParams.getAll("family")) {
        for (const f of fam.split("|")) googleFonts.add(f.split(":")[0].replace(/\+/g, " ").trim());
      }
    }
  }

  const inlineCss = [
    ...root.querySelectorAll("style").map((s) => s.text),
    ...root.querySelectorAll("[style]").slice(0, 400).map((e) => e.getAttribute("style") ?? ""),
  ].join("\n");
  const allCss = [inlineCss, ...extraCss].join("\n");

  const colors = [...collectColors(allCss).values()].sort((a, b) => b.weight - a.weight).slice(0, 24);
  const fontFamilies = [...collectFonts(allCss).entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    url: base.toString(),
    title,
    siteName,
    description,
    themeColor,
    logoCandidates: [...new Set(logos)].slice(0, 6),
    ogImage,
    stylesheetUrls: stylesheetUrls.filter((u) => !u.includes("fonts.googleapis.com")).slice(0, 4),
    googleFonts: [...googleFonts].slice(0, 6),
    fontFamilies,
    colors,
    radii: collectRadii(allCss),
    isInstagram: /(^|\.)instagram\.com$/i.test(base.hostname),
  };
}
