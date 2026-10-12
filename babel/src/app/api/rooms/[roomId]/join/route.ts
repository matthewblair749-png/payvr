import { NextResponse, type NextRequest } from "next/server";
import { ROOMS } from "@/config/rooms";
import { currentUserId } from "@/features/auth/auth";
import { joinSchema } from "@/features/rooms/protocol";
import { joinRoom, RoomRuleError } from "@/features/rooms/server/rooms";
import { RateLimiter } from "@/features/translation/server/rate-limit";
import { db } from "@/server/db";

const joinLimiter = new RateLimiter(ROOMS.joinRate.limit, ROOMS.joinRate.windowMs);

const MESSAGES: Record<string, { status: number; message: string }> = {
  not_found: { status: 404, message: "This room doesn't exist. Check the link with whoever sent it." },
  closed: { status: 410, message: "This room has closed, and its messages were deleted." },
  full: { status: 409, message: "This room is full right now. Ask the host to make some space." },
  banned: { status: 403, message: "The host removed you from this room." },
};

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** POST /api/rooms/:roomId/join → { participantId, token } for the realtime connection. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/rooms/[roomId]/join">) {
  const { roomId } = await ctx.params;
  const ip = clientIp(request);

  const wait = joinLimiter.check(ip);
  if (wait > 0) return NextResponse.json({ ok: false, message: "Too many tries. Wait a minute and try again." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "That didn't come through right. Try again?" }, { status: 400 });
  }
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Check your name and language." }, { status: 400 });
  }

  try {
    const result = await joinRoom(db, { roomId, userId: await currentUserId(), ip, ...parsed.data });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RoomRuleError && MESSAGES[error.code]) {
      const { status, message } = MESSAGES[error.code];
      return NextResponse.json({ ok: false, code: error.code, message }, { status });
    }
    console.error("room join failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, message: "Something went wrong joining. Please try again." }, { status: 500 });
  }
}
