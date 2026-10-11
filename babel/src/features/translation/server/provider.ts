import type { LanguageCode, SourceLanguage } from "../languages";
import type { Formality } from "../types";

export interface ProviderRequest {
  text: string;
  from: SourceLanguage;
  to: LanguageCode;
  formality: Formality;
}

export interface ProviderResult {
  text: string;
  /** Detected (or given) source language. */
  from: LanguageCode | "unknown";
}

/**
 * Every translation engine (API or LLM) implements this. The rest of the app
 * only ever talks to `translate()` in ./translate.ts, never to a provider.
 */
export interface TranslationProvider {
  /** Stable id, part of the cache key so engines never share results. */
  readonly id: string;
  translate(request: ProviderRequest): Promise<ProviderResult>;
}

/** Thrown when the preview provider is asked for text it doesn't know. */
export class NotInPreviewError extends Error {
  constructor() {
    super("This sentence isn't in the preview phrasebook.");
    this.name = "NotInPreviewError";
  }
}

/** Thrown for upstream failures. The message is safe to log (no user text). */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
