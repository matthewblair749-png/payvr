/**
 * Limits for page translation requests from the browser extension. Shared
 * with the extension build so both sides agree.
 */
export const EXTENSION_LIMITS = {
  /** Text pieces per request. The extension splits bigger pages. */
  maxSegments: 100,
  /** Characters in one piece. Longer ones are left untranslated. */
  maxSegmentChars: 5_000,
  /** Characters in one request. */
  maxRequestChars: 20_000,
  /** Requests per minute per user, so a runaway page can't spin forever. */
  requestsPerMinute: 120,
  /** Translations run this many at a time per request. */
  concurrency: 8,
} as const;
