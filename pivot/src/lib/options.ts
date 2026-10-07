/**
 * Choices shown in forms. Kept free of zod so client components that list
 * them don't ship the validation library (validation.ts re-exports these).
 */
export const INDUSTRIES = [
  { id: "ecommerce", label: "E-commerce / direct-to-consumer" },
  { id: "retail", label: "Retail" },
  { id: "saas", label: "Software / SaaS" },
  { id: "services", label: "Services / agency" },
  { id: "marketplace", label: "Marketplace" },
  { id: "other", label: "Something else" },
] as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
