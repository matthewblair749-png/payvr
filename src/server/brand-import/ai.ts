import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { BrandSignals } from "@/lib/brand/extract";
import type { BrandGuess } from "@/lib/brand/heuristics";
import { FONT_KEYS, FONTS } from "@/lib/checkout/meta";

/**
 * Claude refines the heuristic guess into a tasteful checkout theme.
 * We send compact, pre-extracted signals (never raw HTML) plus the logo image
 * when we have one, and get back schema-validated JSON.
 */
export const AI_MODEL = process.env.LUMEN_AI_MODEL ?? "claude-opus-5-5";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const ThemeOut = z.object({
  brandName: z.string().max(48),
  accent: hex.describe("Primary button color, the brand's signature color"),
  background: hex.describe("Page background behind the checkout card; usually a soft neutral or light tint"),
  mode: z.enum(["light", "dark"]),
  font: z.enum(FONT_KEYS),
  radius: z.number().int().min(0).max(28),
  rationale: z.string().max(200).describe("One short, friendly sentence for the merchant explaining the choices"),
});

export type ImageInput = { mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; base64: string };

let client: Anthropic | null = null;
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function refineWithClaude(
  signals: BrandSignals,
  baseline: BrandGuess,
  image: ImageInput | null,
  signal?: AbortSignal,
): Promise<BrandGuess | null> {
  if (!aiEnabled()) return null;
  client ??= new Anthropic({ maxRetries: 1 });

  const compact = {
    url: signals.url,
    title: signals.title,
    siteName: signals.siteName,
    description: signals.description?.slice(0, 300),
    themeColor: signals.themeColor,
    topColors: signals.colors.slice(0, 14).map((c) => `${c.hex} (x${c.count}${c.weight > c.count ? ", brand variable" : ""})`),
    googleFonts: signals.googleFonts,
    cssFonts: signals.fontFamilies.map((f) => `${f.name} (x${f.count})`),
    cornerRadiiPx: signals.radii.slice(0, 40),
    isInstagram: signals.isInstagram,
  };
  const fontList = FONT_KEYS.map((k) => `${k} = ${FONTS[k].label}`).join(", ");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (image) {
    content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } });
  }
  content.push({
    type: "text",
    text:
      `Design a checkout page theme that feels unmistakably like this brand.\n\n` +
      `Signals extracted from their ${signals.isInstagram ? "Instagram profile" : "website"}:\n` +
      `${JSON.stringify(compact, null, 2)}\n\n` +
      `A simple heuristic suggested: ${JSON.stringify(baseline.theme)} and name "${baseline.brandName}".\n\n` +
      (image ? "The image above is their logo or profile picture; use it to confirm the signature color.\n\n" : "") +
      `Rules: accent must be the brand's signature color, not a gray or near-black unless the brand is truly monochrome. ` +
      `Background should be calm (light neutral or a very light brand tint), or dark only if the brand is clearly dark. ` +
      `Font must be one of: ${fontList} — pick the closest in personality. ` +
      `brandName is how the brand writes its own name (no taglines, no "Home", no "| Shop").`,
  });

  try {
    const res = await client.beta.messages.parse(
      {
        model: AI_MODEL,
        max_tokens: 4000,
        // Server-side fallback: if the request is declined by a safeguard, the API
        // retries on an appropriate model instead of failing the import.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Low effort keeps this well inside the ~10s import budget.
        output_config: { effort: "low", format: betaZodOutputFormat(ThemeOut) },
        system: "You are a senior brand designer at lumen, a checkout builder for creators and small brands.",
        messages: [{ role: "user", content }],
      },
      { signal, timeout: 15_000 },
    );
    if (res.stop_reason === "refusal" || !res.parsed_output) return null;
    const out = res.parsed_output;
    return {
      brandName: out.brandName.trim() || baseline.brandName,
      logoUrl: baseline.logoUrl,
      theme: {
        accent: out.accent.toUpperCase(),
        background: out.background.toUpperCase(),
        mode: out.mode,
        font: out.font,
        radius: out.radius,
      },
      rationale: out.rationale,
    };
  } catch (e) {
    // Any AI failure degrades gracefully to the heuristic result.
    if (e instanceof Anthropic.APIError) console.warn(`[brand-import] Claude ${e.status}: ${e.message}`);
    else if (!(e instanceof Error && e.name === "AbortError")) console.warn("[brand-import] Claude failed", e);
    return null;
  }
}
