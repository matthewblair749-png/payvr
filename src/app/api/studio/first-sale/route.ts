import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { uncelebratedFirstSale } from "@/server/dal/orders";

/** Polled by the Studio so the first-sale celebration appears without a reload. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ sale: null }, { status: 401 });
  const merchant = await db.merchant.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  const sale = merchant ? await uncelebratedFirstSale(merchant.id) : null;
  return Response.json({ sale }, { headers: { "cache-control": "no-store" } });
}
