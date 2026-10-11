import { NextResponse, type NextRequest } from "next/server";
import { NotInPreviewError } from "@/features/translation/server/provider";
import { RateLimiter } from "@/features/translation/server/rate-limit";
import { translateRequestSchema } from "@/features/translation/server/schema";
import { translate } from "@/features/translation/server/translate";
import type { TranslateErrorCode, TranslateResponse } from "@/features/translation/types";

// 20 translations per 5 minutes per visitor for the public demo.
const limiter = new RateLimiter(20, 5 * 60_000);

function fail(code: TranslateErrorCode, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json<TranslateResponse>({ ok: false, code, message }, { status, headers });
}

function clientId(request: NextRequest): string {
  // First hop in x-forwarded-for is the visitor when behind a trusted proxy.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous";
}

export async function POST(request: NextRequest) {
  const waitMs = limiter.check(clientId(request));
  if (waitMs > 0) {
    const seconds = Math.ceil(waitMs / 1000);
    return fail("rate_limited", `You're quick! Give it ${seconds} seconds and try again.`, 429, {
      "Retry-After": String(seconds),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_input", "That request didn't come through right. Try again?", 400);
  }

  const parsed = translateRequestSchema.safeParse(body);
  if (!parsed.success) {
    // Only the text-length messages are written for people; anything else is a malformed request.
    const textIssue = parsed.error.issues.find((issue) => issue.path[0] === "text");
    return fail("invalid_input", textIssue?.message ?? "That request didn't come through right. Try again?", 400);
  }

  const { text, from, to, formality } = parsed.data;
  try {
    const result = await translate(text, from, to, { formality });
    return NextResponse.json<TranslateResponse>({ ok: true, result });
  } catch (error) {
    if (error instanceof NotInPreviewError) {
      return fail(
        "not_in_preview",
        "This preview only knows a few sentences so far. Try one of the suggestions above.",
        422,
      );
    }
    // Log the error type only: never the text people asked us to translate.
    console.error("translate failed:", error instanceof Error ? `${error.name}: ${error.message}` : "unknown error");
    return fail("provider_error", "Our translator tripped over that one. Give it another go in a moment.", 502);
  }
}
