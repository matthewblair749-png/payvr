import { z } from "zod";
import { isLanguageCode, type LanguageCode } from "../../languages";
import { ProviderError, type ProviderRequest, type ProviderResult, type TranslationProvider } from "../provider";

/** DeepL target codes differ slightly from ours for regional variants. */
const TARGET_CODES: Record<LanguageCode, string> = {
  en: "EN-US",
  es: "ES",
  fr: "FR",
  de: "DE",
  it: "IT",
  pt: "PT-BR",
  ja: "JA",
  ko: "KO",
  zh: "ZH-HANS",
  ar: "AR",
};

const FORMALITY = { default: "default", formal: "prefer_more", informal: "prefer_less" } as const;

const responseSchema = z.object({
  translations: z
    .array(z.object({ text: z.string(), detected_source_language: z.string() }))
    .min(1),
});

export class DeepLProvider implements TranslationProvider {
  readonly id = "deepl";
  private readonly endpoint: string;

  constructor(private readonly apiKey: string) {
    // Free-tier keys end in ":fx" and live on a different host.
    this.endpoint = apiKey.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";
  }

  async translate({ text, from, to, formality }: ProviderRequest): Promise<ProviderResult> {
    const body: Record<string, unknown> = {
      text: [text],
      target_lang: TARGET_CODES[to],
      formality: FORMALITY[formality],
    };
    if (from !== "auto") body.source_lang = from.toUpperCase();

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new ProviderError(`DeepL responded ${res.status}`);

    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) throw new ProviderError("DeepL returned an unexpected shape");

    const first = parsed.data.translations[0];
    const detected = first.detected_source_language.toLowerCase().slice(0, 2);
    return { text: first.text, from: isLanguageCode(detected) ? detected : "unknown" };
  }
}
