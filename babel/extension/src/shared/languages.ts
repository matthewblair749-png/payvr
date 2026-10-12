// The extension shares the app's language list, so both always agree.
export { LANGUAGES, isLanguageCode, getLanguage, type LanguageCode } from "@babel-app/features/translation/languages";
import { isLanguageCode, type LanguageCode } from "@babel-app/features/translation/languages";

export function defaultLanguage(): LanguageCode {
  const code = (navigator.language || "en").slice(0, 2).toLowerCase();
  return isLanguageCode(code) ? code : "en";
}
