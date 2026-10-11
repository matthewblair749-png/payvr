import { describe, expect, it } from "vitest";
import { LANGUAGE_CODES } from "@/features/translation/languages";
import { PHRASEBOOK } from "@/features/translation/phrasebook";
import { NotInPreviewError } from "@/features/translation/server/provider";
import { PreviewProvider } from "@/features/translation/server/providers/preview";

const provider = new PreviewProvider();

describe("PreviewProvider", () => {
  it("has every phrase in every language", () => {
    for (const entry of PHRASEBOOK) {
      for (const code of LANGUAGE_CODES) {
        if (code === "en") continue;
        expect(entry.translations[code], `${entry.id} → ${code}`).toBeTruthy();
      }
    }
  });

  it("translates a known English sentence and reports the source", async () => {
    const result = await provider.translate({ text: PHRASEBOOK[1].source, from: "auto", to: "de", formality: "default" });
    expect(result).toEqual({ text: PHRASEBOOK[1].translations.de, from: "en" });
  });

  it("works between two non-English languages and back to English", async () => {
    const spanish = PHRASEBOOK[0].translations.es;
    const french = await provider.translate({ text: spanish, from: "auto", to: "fr", formality: "default" });
    expect(french).toEqual({ text: PHRASEBOOK[0].translations.fr, from: "es" });
    const english = await provider.translate({ text: spanish, from: "auto", to: "en", formality: "default" });
    expect(english.text).toBe(PHRASEBOOK[0].source);
  });

  it("tolerates extra whitespace", async () => {
    const messy = `  ${PHRASEBOOK[2].source.replace(/ /g, "   ")}\n`;
    const result = await provider.translate({ text: messy, from: "auto", to: "it", formality: "default" });
    expect(result.text).toBe(PHRASEBOOK[2].translations.it);
  });

  it("refuses text it does not know instead of guessing", async () => {
    await expect(
      provider.translate({ text: "Where is the library?", from: "auto", to: "es", formality: "default" }),
    ).rejects.toBeInstanceOf(NotInPreviewError);
  });
});
