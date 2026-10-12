import { lookupPhrase } from "../../phrasebook";
import { NotInPreviewError, type ProviderRequest, type ProviderResult, type TranslationProvider } from "../provider";

/**
 * Serves the hand-checked phrasebook. Lets the landing page demo run with no
 * API keys at all. Anything outside the phrasebook raises NotInPreviewError.
 */
export class PreviewProvider implements TranslationProvider {
  readonly id = "preview";

  async translate({ text, to }: ProviderRequest): Promise<ProviderResult> {
    const hit = lookupPhrase(text, to);
    if (!hit) throw new NotInPreviewError();
    return { text: hit.text, from: hit.from };
  }
}
