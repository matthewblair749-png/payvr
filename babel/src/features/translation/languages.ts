/**
 * Languages Babel supports today. Shared by the client (chips, labels) and the
 * server (validation, provider codes). Add a language here and everything
 * else picks it up.
 */
export const LANGUAGES = [
  { code: "en", name: "English", native: "English", dir: "ltr" },
  { code: "es", name: "Spanish", native: "Español", dir: "ltr" },
  { code: "fr", name: "French", native: "Français", dir: "ltr" },
  { code: "de", name: "German", native: "Deutsch", dir: "ltr" },
  { code: "it", name: "Italian", native: "Italiano", dir: "ltr" },
  { code: "pt", name: "Portuguese (Brazil)", native: "Português", dir: "ltr" },
  { code: "ja", name: "Japanese", native: "日本語", dir: "ltr" },
  { code: "ko", name: "Korean", native: "한국어", dir: "ltr" },
  { code: "zh", name: "Chinese (Simplified)", native: "中文", dir: "ltr" },
  { code: "ar", name: "Arabic", native: "العربية", dir: "rtl" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export type Language = (typeof LANGUAGES)[number];

/** Source language can also be "auto": let the provider work it out. */
export type SourceLanguage = LanguageCode | "auto";

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];

export function getLanguage(code: LanguageCode): Language {
  const found = LANGUAGES.find((l) => l.code === code);
  if (!found) throw new Error(`Unknown language: ${code}`);
  return found;
}

export function isLanguageCode(value: string): value is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}
