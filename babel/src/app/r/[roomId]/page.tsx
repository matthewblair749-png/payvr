import type { Metadata } from "next";
import { auth } from "@/features/auth/auth";
import { EndedScreen, RoomApp } from "@/features/rooms/components/room-app";
import { isOpen } from "@/features/rooms/server/rooms";
import { isLanguageCode, type LanguageCode } from "@/features/translation/languages";
import { db } from "@/server/db";

export const metadata: Metadata = {
  title: "Room",
  // Room links are private: keep them out of search engines.
  robots: { index: false, follow: false },
};

export default async function RoomPage(props: PageProps<"/r/[roomId]">) {
  const { roomId } = await props.params;
  const room = /^[A-Za-z0-9]{6,32}$/.test(roomId) ? await db.room.findUnique({ where: { id: roomId } }) : null;
  if (!room || !isOpen(room)) return <EndedScreen reason="closed" />;

  // The signed-in owner skips the join form and gets their host seat back.
  const session = await auth();
  let owner: { displayName: string; language: LanguageCode } | null = null;
  if (session?.user?.id === room.ownerId) {
    const seat = await db.roomParticipant.findFirst({ where: { roomId, role: "owner" } });
    owner = {
      displayName: seat?.displayName ?? "Host",
      language: seat && isLanguageCode(seat.language) ? seat.language : "en",
    };
  }

  return (
    <RoomApp
      roomId={room.id}
      roomName={room.name}
      realtimeUrl={process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001"}
      owner={owner}
    />
  );
}
