"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "./auth/session";
import { db } from "./db";

/** Switch the active workspace. Only to a company the user is a member of. */
export async function switchWorkspace(companyId: string) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (typeof companyId !== "string" || companyId.length > 40) return;
  const member = await db.companyMember.findUnique({ where: { companyId_userId: { companyId, userId: user.id } }, select: { id: true } });
  if (!member) return;
  await db.user.update({ where: { id: user.id }, data: { activeCompanyId: companyId } });
  // The shell (sidebar, workspace name, the company id actions send) lives in the
  // layout, which a redirect alone would reuse from the client cache.
  revalidatePath("/app", "layout");
  redirect("/app");
}
