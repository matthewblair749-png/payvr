import type { LanguageCode, SourceLanguage } from "./languages";

export type Formality = "default" | "formal" | "informal";

export interface TranslateOptions {
  /** Tone of voice, where the provider supports it. */
  formality?: Formality;
  /**
   * Skip the persistent cache. Use for private text (room messages) that
   * should not outlive the conversation.
   */
  noCache?: boolean;
}

export interface TranslationResult {
  text: string;
  from: LanguageCode | "unknown";
  to: LanguageCode;
  /** Which provider produced it ("preview" means the built-in phrasebook). */
  provider: string;
  cached: boolean;
}

/** Shape returned by POST /api/translate. */
export type TranslateResponse =
  | { ok: true; result: TranslationResult }
  | { ok: false; code: TranslateErrorCode; message: string };

export type TranslateErrorCode =
  | "invalid_input"
  | "rate_limited"
  | "not_in_preview"
  | "provider_error";

export type { LanguageCode, SourceLanguage };
