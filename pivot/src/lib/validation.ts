import { z } from "zod";

/** Shared input rules. Everything a user types is trimmed and length-capped. */
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: "That email is too long." })
  .pipe(z.email({ error: "Enter a valid email address." }));

const COMMON = new Set(["password1234", "1234567890", "qwertyuiop", "password123", "letmein1234", "iloveyou123", "pivotpivot1"]);

export const password = z
  .string()
  .min(10, { error: "Use at least 10 characters." })
  .max(200, { error: "That password is too long." })
  .refine((p) => !COMMON.has(p.toLowerCase()), { error: "That password is too common. Try a short phrase instead." })
  .refine((p) => new Set(p).size >= 5, { error: "Use a less repetitive password." });

export const personName = z.string().trim().min(2, { error: "Enter your name." }).max(80, { error: "Keep it under 80 characters." });
export const companyName = z.string().trim().min(2, { error: "Enter your company name." }).max(80, { error: "Keep it under 80 characters." });

export const INDUSTRIES = [
  { id: "ecommerce", label: "E-commerce / direct-to-consumer" },
  { id: "retail", label: "Retail" },
  { id: "saas", label: "Software / SaaS" },
  { id: "services", label: "Services / agency" },
  { id: "marketplace", label: "Marketplace" },
  { id: "other", label: "Something else" },
] as const;
export const industry = z.enum(["ecommerce", "retail", "saas", "services", "marketplace", "other"]);

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

/** Flatten zod issues to { field: firstMessage }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "form");
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}
