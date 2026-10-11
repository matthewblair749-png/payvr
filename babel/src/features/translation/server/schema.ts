import { z } from "zod";
import { LANGUAGE_CODES } from "../languages";
import { DEMO_MAX_CHARS } from "../limits";

export const translateRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Type or paste something first.")
    .max(DEMO_MAX_CHARS, `That's a lot of words. The demo takes up to ${DEMO_MAX_CHARS.toLocaleString("en-US")} characters.`),
  from: z.enum([...LANGUAGE_CODES, "auto"]).default("auto"),
  to: z.enum(LANGUAGE_CODES),
  formality: z.enum(["default", "formal", "informal"]).default("default"),
});

export type TranslateRequest = z.infer<typeof translateRequestSchema>;
