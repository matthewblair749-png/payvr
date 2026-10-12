import "server-only";
import { z } from "zod";
import type { TranslationProvider } from "../provider";
import { AnthropicProvider } from "./anthropic";
import { DeepLProvider } from "./deepl";
import { PreviewProvider } from "./preview";

const envSchema = z.object({
  TRANSLATION_PROVIDER: z.enum(["deepl", "anthropic", "preview"]).optional(),
  DEEPL_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
});

/**
 * Pick the provider from env. Switching engines is a one-line env change;
 * no other code needs to know which one is running.
 */
export function createProviderFromEnv(env: NodeJS.ProcessEnv = process.env): TranslationProvider {
  const config = envSchema.parse(env);
  const choice = config.TRANSLATION_PROVIDER ?? "preview";

  if (choice === "deepl") {
    if (!config.DEEPL_API_KEY) throw new Error("TRANSLATION_PROVIDER=deepl needs DEEPL_API_KEY");
    return new DeepLProvider(config.DEEPL_API_KEY);
  }
  if (choice === "anthropic") {
    if (!config.ANTHROPIC_API_KEY) throw new Error("TRANSLATION_PROVIDER=anthropic needs ANTHROPIC_API_KEY");
    return new AnthropicProvider(config.ANTHROPIC_API_KEY, config.ANTHROPIC_MODEL || "claude-opus-5-5");
  }
  return new PreviewProvider();
}
