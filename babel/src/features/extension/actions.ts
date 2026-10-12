"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/features/auth/auth";
import { db } from "@/server/db";
import { browserLabel, createExtensionToken, revokeExtensionToken } from "./server/tokens";

/** Issues a token for this browser's extension. Returned once to the page, which hands it over. */
export async function connectExtensionAction(): Promise<{ ok: true; token: string; email: string } | { ok: false }> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) return { ok: false };
  const label = browserLabel((await headers()).get("user-agent"));
  return { ok: true, token: await createExtensionToken(db, userId, label), email };
}

export async function disconnectExtensionAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  const tokenId = formData.get("tokenId");
  if (!userId || typeof tokenId !== "string") return;
  await revokeExtensionToken(db, userId, tokenId);
  revalidatePath("/dashboard");
}
