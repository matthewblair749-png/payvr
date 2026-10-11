"use server";

import { redirect } from "next/navigation";
import { auth } from "@/features/auth/auth";
import { db } from "@/server/db";
import { createRoomSchema } from "./protocol";
import { createRoom, RoomRuleError } from "./server/rooms";

/** Creates a room for the signed-in user and opens it. */
export async function createRoomAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/signin?callbackUrl=${encodeURIComponent("/dashboard")}`);

  const parsed = createRoomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard?rooms=invalid#rooms");

  let roomId: string;
  try {
    ({ roomId } = await createRoom(db, { ownerId: userId, ...parsed.data }));
  } catch (error) {
    if (error instanceof RoomRuleError && error.code === "too_many_rooms") redirect("/dashboard?rooms=too_many#rooms");
    throw error;
  }
  redirect(`/r/${roomId}`);
}
