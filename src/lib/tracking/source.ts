/**
 * Traffic sources, classified server-side from two hints the browser sends on
 * a checkout VIEW: the referrer's *hostname* (never the full URL or path) and
 * the `utm_source` tag. A small fixed set keeps segments readable.
 */
export const SOURCES = ["instagram", "tiktok", "email", "search", "facebook", "direct", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  email: "Email",
  search: "Search",
  facebook: "Facebook",
  direct: "Direct",
  other: "Other sites",
};

const UTM: [RegExp, Source][] = [
  [/^(ig|insta|instagram)/, "instagram"],
  [/^(tt|tiktok)/, "tiktok"],
  [/(email|newsletter|klaviyo|mailchimp|convertkit|substack|beehiiv)/, "email"],
  [/^(fb|facebook|meta)/, "facebook"],
  [/^(google|bing|duckduckgo|ddg)/, "search"],
];

const HOSTS: [RegExp, Source][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(facebook\.com|fb\.com|messenger\.com)$/, "facebook"],
  [/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|ecosia\.org)$/, "search"],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$/, "email"],
];

export function classifySource(ref: string | null | undefined, utm: string | null | undefined, ownHost?: string | null): Source {
  const tag = utm?.trim().toLowerCase();
  if (tag) {
    for (const [re, s] of UTM) if (re.test(tag)) return s;
    return "other";
  }
  const host = ref?.trim().toLowerCase().replace(/^www\./, "");
  if (!host || (ownHost && host === ownHost.toLowerCase().replace(/^www\./, ""))) return "direct";
  // Webmail is checked before search: mail.google.com is not a Google search.
  const email = HOSTS.find(([, s]) => s === "email")!;
  if (email[0].test(host)) return "email";
  for (const [re, s] of HOSTS) if (re.test(host)) return s;
  return "other";
}

/** Order-value bands for segments (cart value at the start of checkout). */
export const VALUE_BANDS = [
  { key: "under50", label: "Under $50", max: 5000 },
  { key: "50to99", label: "$50 to $99", max: 10000 },
  { key: "100plus", label: "$100 or more", max: Infinity },
] as const;
