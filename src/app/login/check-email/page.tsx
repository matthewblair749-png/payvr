import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { lastDevMagicLink } from "@/server/email";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  const dev = lastDevMagicLink();
  return (
    <AuthShell>
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-spark text-ink">
        <MailCheck size={26} aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-[-0.05em]">Check your inbox</h1>
      <p className="mt-3 text-muted-strong">We sent you a sign-in link. It works once and expires in 24 hours.</p>
      {dev && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-ink/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-strong">Local dev: no email server set</p>
          <p className="mt-1 break-all text-sm">{dev.email}</p>
          <a
            href={dev.url}
            className="mt-3 inline-flex rounded-full bg-orange px-5 py-2.5 font-semibold text-white"
          >
            Open magic link
          </a>
        </div>
      )}
    </AuthShell>
  );
}
