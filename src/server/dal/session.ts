import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "../auth";
import { db } from "../db";

/**
 * Resolve the signed-in user's Merchant, creating it on first visit.
 * Every Studio query is scoped by the id returned here — that's our
 * row-level access boundary. `cache` dedupes it within one request.
 */
export const requireMerchant = cache(async (nextPath = "/studio") => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const existing = await db.merchant.findUnique({ where: { userId } });
  if (existing) return existing;

  const email = session.user?.email ?? "";
  const name = session.user?.name || email.split("@")[0] || "My shop";
  return db.merchant.upsert({ where: { userId }, update: {}, create: { userId, name } });
});

/** For server actions: same as requireMerchant but throws instead of redirecting. */
export async function merchantForAction() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not signed in");
  const merchant = await db.merchant.findUnique({ where: { userId } });
  if (!merchant) throw new Error("Merchant not found");
  return merchant;
}
