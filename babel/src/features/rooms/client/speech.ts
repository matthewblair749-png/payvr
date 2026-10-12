import type { LanguageCode } from "@/features/translation/languages";

/**
 * Speech-to-text behind one small interface. Today: the browser's built-in
 * speech recognition (early version). A server-side engine can implement the
 * same interface later without changing the composer.
 */
export interface SpeechToText {
  readonly supported: boolean;
  /** Plain-language note on where the audio goes, shown next to the mic. */
  readonly privacyNote: string;
  start(language: LanguageCode, handlers: SpeechHandlers): void;
  stop(): void;
}

export interface SpeechHandlers {
  /** Text so far, while still listening. */
  onInterim(text: string): void;
  /** Final text for this utterance. */
  onFinal(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

const BCP47: Record<LanguageCode, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-BR",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  ar: "ar-SA",
};

// The Web Speech API isn't in TypeScript's DOM types; this is the part we use.
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. You can allow it in your browser's site settings.",
  "service-not-allowed": "Your browser won't let this page use speech recognition.",
  "no-speech": "I didn't hear anything. Try again a little closer to the mic.",
  network: "Speech recognition needs a connection.",
  "audio-capture": "No microphone found.",
};

export const BROWSER_SPEECH_PRIVACY_NOTE =
  "It uses your browser's speech recognition, and some browsers send the audio to their maker's servers (Google for Chrome, Apple for Safari).";

export class BrowserSpeechToText implements SpeechToText {
  readonly privacyNote = BROWSER_SPEECH_PRIVACY_NOTE;
  private recognition: Recognition | null = null;

  get supported(): boolean {
    return recognitionCtor() !== null;
  }

  start(language: LanguageCode, handlers: SpeechHandlers): void {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      handlers.onError("Voice input isn't available in this browser yet. Chrome, Edge and Safari support it.");
      handlers.onEnd();
      return;
    }
    this.stop();
    const recognition = new Ctor();
    recognition.lang = BCP47[language];
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) handlers.onFinal(final.trim());
      else handlers.onInterim(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") handlers.onError(ERRORS[event.error] ?? "Voice input stopped unexpectedly.");
    };
    recognition.onend = () => {
      this.recognition = null;
      handlers.onEnd();
    };
    this.recognition = recognition;
    recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
  }
}
