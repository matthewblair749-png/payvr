import { NextResponse } from "next/server";
import { EXTENSION_LIMITS } from "@/features/extension/limits";
import { userForToken } from "@/features/extension/server/tokens";
import { pageTranslateSchema, translateSegments } from "@/features/extension/server/translate-page";
import { RateLimiter } from "@/features/translation/server/rate-limit";
import { translate } from "@/features/translation/server/translate";
import { reserveUsage } from "@/features/usage/server";
import { db } from "@/server/db";

const limiter = new RateLimiter(EXTENSION_LIMITS.requestsPerMinute, 60_000);

/**
 * POST /api/extension/translate (Authorization: Bearer <extension token>)
 * Body: { pageId, to, segments[] } → { translations: (string | null)[], usage }
 * A page counts once toward the daily limit, however many requests it takes.
 */
export async function POST(request: Request) {
  const userId = await userForToken(db, request.headers.get("authorization"));
  if (!userId) return NextResponse.json({ ok: false, code: "unauthorized", message: "Connect the extension to your Babel account first." }, { status: 401 });

  if (limiter.check(userId) > 0) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "That's a lot of translating at once. Give it a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_input", message: "Bad request." }, { status: 400 });
  }
  const parsed = pageTranslateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, code: "invalid_input", message: "Bad request." }, { status: 400 });
  const { pageId, to, segments } = parsed.data;

  const reservation = await reserveUsage(db, userId, "translation", 1, new Date(), `page:${pageId}:${to}`);
  if (!reservation.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "limit_reached",
        message: `That's all ${reservation.limit} translations for today. More arrive at midnight UTC, or upgrade for more.`,
      },
      { status: 429 },
    );
  }

  const translations = await translateSegments(translate, segments, to);
  return NextResponse.json({ ok: true, translations, usage: { used: reservation.used, limit: reservation.limit } });
}
