import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvite } from "@/components/auth/accept-invite";
import { hashToken } from "@/server/auth/tokens";
import { currentUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Join a workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite =
    token.length <= 100
      ? await db.invitation.findUnique({ where: { tokenHash: hashToken(token) }, select: { email: true, acceptedAt: true, expiresAt: true, company: { select: { name: true } }, invitedBy: { select: { name: true } } } })
      : null;
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();
  const user = await currentUser();
  const here = `/invite/${token}`;

  if (!valid) {
    return (
      <>
        <h1 className="text-3xl font-heavy tracking-tighter text-ink">This invitation has expired</h1>
        <p className="mt-3 text-[15px] text-muted">Invitations last 7 days and work once. Ask your teammate to send a new one.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-ink underline underline-offset-4">
          Go to PIVOT
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-3xl font-heavy tracking-tighter text-ink">Join {invite.company.name}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {invite.invitedBy.name} invited {invite.email} to their PIVOT workspace.
      </p>
      <div className="mt-8">
        {user ? (
          <AcceptInvite token={token} />
        ) : (
          <div className="space-y-3">
            <Link href={`/signup?next=${encodeURIComponent(here)}`} className="flex h-13 w-full items-center justify-center rounded-full bg-accent font-heavy text-white hover:bg-accent-hover">
              Create an account to join
            </Link>
            <Link href={`/login?next=${encodeURIComponent(here)}`} className="flex h-13 w-full items-center justify-center rounded-full border border-line-strong font-heavy text-ink hover:bg-sunken">
              I already have an account
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
