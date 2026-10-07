import { Bell, Building2, Check, CreditCard, Database, Sparkles, User, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyForm, InviteForm, PasswordForm, PlanButton, PortalButton, ProfileForm, RowButton, ToggleRow } from "@/components/app/settings-forms";
import { PageHeader } from "@/components/app/shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/field";
import { PLANS } from "@/lib/billing/plans";
import { dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { aiStatus } from "@/server/ai";
import { stripeConfigured } from "@/server/billing/stripe";
import { db } from "@/server/db";
import { removeMember, revokeInvite } from "@/server/settings-actions";
import type { Workspace } from "@/server/workspace";

export const SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "company", label: "Company", icon: Building2 },
  { id: "team", label: "Team", icon: Users },
  { id: "data", label: "Data connections", icon: Database },
  { id: "ai", label: "AI settings", icon: Sparkles },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "billing", label: "Billing", icon: CreditCard },
] as const;

export async function SettingsPage({ ws, tab, checkout }: { ws: Workspace; tab: string; checkout?: string }) {
  const t = SETTINGS_TABS.find((x) => x.id === tab);
  if (!t) notFound();
  const demo = ws.mode === "demo";
  const canAdmin = ws.role === "OWNER" || ws.role === "ADMIN";
  return (
    <>
      <PageHeader title="Settings" subtitle={demo ? "This is what settings look like. Changes are off in the demo." : `Manage your account and ${ws.company.name}'s workspace.`} />
      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Settings" className="pv-scroll-x -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {SETTINGS_TABS.map((x) => (
            <Link
              key={x.id}
              href={`${ws.basePath}/settings/${x.id}`}
              aria-current={x.id === t.id ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-[15px]",
                x.id === t.id ? "bg-surface font-heavy text-ink shadow-card ring-1 ring-line" : "text-ink-2 hover:bg-sunken hover:text-ink",
              )}
            >
              <x.icon size={17} aria-hidden="true" /> {x.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          {demo && t.id !== "billing" && (
            <FormMessage tone="info">
              You&apos;re viewing the demo workspace.{" "}
              <Link href={ws.user ? "/app/settings" : "/signup"} className="underline">
                {ws.user ? "Open your own settings" : "Create your workspace"}
              </Link>{" "}
              to change settings.
            </FormMessage>
          )}
          {t.id === "profile" && <Profile ws={ws} />}
          {t.id === "company" && <CompanySettings ws={ws} readOnly={demo || !canAdmin} />}
          {t.id === "team" && <Team ws={ws} />}
          {t.id === "data" && <DataConnections ws={ws} />}
          {t.id === "ai" && <AiSettings ws={ws} readOnly={demo || !canAdmin} />}
          {t.id === "notifications" && <Notifications ws={ws} />}
          {t.id === "billing" && <Billing ws={ws} checkout={checkout} />}
        </div>
      </div>
    </>
  );
}

function Profile({ ws }: { ws: Workspace }) {
  const user = ws.user;
  if (ws.mode === "demo" || !user) {
    return (
      <Card>
        <CardHeader title="Profile" />
        <CardBody>
          <ProfileForm name="Demo visitor" email="you@yourcompany.com" readOnly />
        </CardBody>
      </Card>
    );
  }
  return (
    <>
      <Card>
        <CardHeader title="Profile" />
        <CardBody>
          <ProfileForm name={user.name} email={user.email} readOnly={false} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Password" />
        <CardBody>
          <PasswordForm />
        </CardBody>
      </Card>
    </>
  );
}

function CompanySettings({ ws, readOnly }: { ws: Workspace; readOnly: boolean }) {
  // Intl's list leaves out "UTC" (every company's default) and could miss a stored value:
  // without them the picker shows, and then saves, a zone nobody chose.
  const timezones = [...new Set(["UTC", ws.company.timezone, ...Intl.supportedValuesOf("timeZone")])];
  return (
    <Card>
      <CardHeader title="Company" description={readOnly && ws.mode === "app" ? "Only owners and admins can change these." : "Used across your analysis and simulations."} />
      <CardBody>
        <CompanyForm company={{ name: ws.company.name, industry: ws.company.industry, currency: ws.company.currency, timezone: ws.company.timezone, marketSharePct: ws.company.marketSharePct }} timezones={timezones} readOnly={readOnly} />
      </CardBody>
    </Card>
  );
}

async function Team({ ws }: { ws: Workspace }) {
  if (ws.mode === "demo") {
    return (
      <Card>
        <CardHeader title="Team" description="Invite your leadership team to see the same numbers and next moves." />
        <CardBody>
          <ul className="divide-y divide-line">
            {[
              ["Dana Reyes", "dana@northstar.example", "Owner"],
              ["Sam Okafor", "sam@northstar.example", "Admin"],
              ["Lee Park", "lee@northstar.example", "Member"],
            ].map(([n, e, r]) => (
              <li key={e} className="flex items-center gap-3 py-3">
                <Avatar name={n} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-ink">{n}</span>
                  <span className="block text-xs text-muted">{e}</span>
                </span>
                <Badge>{r}</Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    );
  }
  const [members, invites] = await Promise.all([
    db.companyMember.findMany({ where: { companyId: ws.company.id }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, userId: true, user: { select: { name: true, email: true } } } }),
    db.invitation.findMany({ where: { companyId: ws.company.id, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, role: true, expiresAt: true } }),
  ]);
  const canInvite = ws.role === "OWNER" || ws.role === "ADMIN";
  const limit = ws.entitlements.limits.members;
  return (
    <>
      <Card>
        <CardHeader title="Members" description={limit === null ? "Unlimited seats on your plan." : `${members.length + invites.length} of ${limit} seat${limit === 1 ? "" : "s"} used${invites.length ? ` (including ${invites.length} pending invitation${invites.length === 1 ? "" : "s"})` : ""}.`} />
        <CardBody>
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar name={m.user.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-ink">
                    {m.user.name}
                    {m.userId === ws.user.id && <span className="text-muted"> (you)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{m.user.email}</span>
                </span>
                <Badge>{m.role.charAt(0) + m.role.slice(1).toLowerCase()}</Badge>
                {ws.role === "OWNER" && m.userId !== ws.user.id && <RowButton action={removeMember.bind(null, m.id)} label="Remove" confirmText={`Remove ${m.user.name} from ${ws.company.name}?`} />}
              </li>
            ))}
          </ul>
          {invites.length > 0 && (
            <>
              <p className="mt-6 text-sm font-heavy text-ink">Pending invitations</p>
              <ul className="mt-2 divide-y divide-line">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink-2">{i.email}</span>
                    <span className="text-xs text-muted">expires {dateLabel(i.expiresAt)}</span>
                    {canInvite && <RowButton action={revokeInvite.bind(null, i.id)} label="Revoke" />}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>
      {canInvite && (
        <Card>
          <CardHeader title="Invite people" description={limit === 1 ? "Team access is part of the Business plan." : "They'll get an email with a link to join."} />
          <CardBody>
            <InviteForm disabled={limit === 1} />
            {limit === 1 && (
              <ButtonLink href="/app/settings/billing" variant="secondary" size="sm" className="mt-3">
                See plans
              </ButtonLink>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}

async function DataConnections({ ws }: { ws: Workspace }) {
  const sources =
    ws.mode === "app"
      ? await db.dataSource.findMany({ where: { companyId: ws.company.id }, select: { id: true, name: true, kind: true, lastSyncedAt: true, _count: { select: { datasets: true } } } })
      : [{ id: "demo", name: "Sample data", kind: "SAMPLE" as const, lastSyncedAt: new Date(), _count: { datasets: 1 } }];
  return (
    <Card>
      <CardHeader title="Data connections" description="Where PIVOT's numbers come from." />
      <CardBody>
        {sources.length ? (
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-4 py-3 text-sm">
                <span className="text-ink">{s.name}</span>
                <span className="text-muted">
                  {s._count.datasets} dataset{s._count.datasets === 1 ? "" : "s"}
                  {s.lastSyncedAt && ` · updated ${dateLabel(s.lastSyncedAt)}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-muted">No data connected yet.</p>
        )}
        <ButtonLink href={`${ws.basePath}/data`} variant="secondary" size="sm" className="mt-4">
          Go to Data
        </ButtonLink>
      </CardBody>
    </Card>
  );
}

function AiSettings({ ws, readOnly }: { ws: Workspace; readOnly: boolean }) {
  const s = aiStatus();
  return (
    <>
      <Card>
        <CardHeader title="AI provider" />
        <CardBody>
          <p className="text-[15px] text-ink-2">
            {s.provider === "anthropic" ? (
              <>
                Written explanations and Ask PIVOT answers use <span className="font-heavy text-ink">Claude</span> ({s.model}).
              </>
            ) : (
              <>
                This workspace uses <span className="font-heavy text-ink">PIVOT&apos;s built-in analysis engine</span> for written explanations and Ask PIVOT. No data leaves PIVOT.
              </>
            )}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink-2">
            {[
              "Numbers, scores and insights always come from PIVOT's analysis engine, not from the AI.",
              "The AI only sees your computed analysis (no raw files), and can't add numbers that aren't in it.",
              "Your data is never used to train AI models.",
            ].map((x) => (
              <li key={x} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" /> {x}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="py-1 sm:py-1">
          <ToggleRow
            id="ai-narratives"
            kind="ai"
            label="AI-written summaries and answers"
            description="When off, PIVOT writes summaries and answers with its built-in engine only."
            initial={ws.company.aiNarratives}
            disabled={readOnly}
          />
        </CardBody>
      </Card>
    </>
  );
}

async function Notifications({ ws }: { ws: Workspace }) {
  const prefs = ws.mode === "app" ? await db.user.findUniqueOrThrow({ where: { id: ws.user.id }, select: { notifyDigest: true, notifyAlerts: true } }) : { notifyDigest: true, notifyAlerts: true };
  return (
    <Card>
      <CardHeader title="Notifications" description="Email only. You can change these anytime." />
      <CardBody className="divide-y divide-line py-1">
        <ToggleRow id="notify-alerts" kind="notifyAlerts" label="Smart alerts" description="Email me when PIVOT finds something that needs action." initial={prefs.notifyAlerts} disabled={ws.mode === "demo"} />
        <ToggleRow id="notify-digest" kind="notifyDigest" label="Monthly summary" description="A short email when a new month of data is analyzed." initial={prefs.notifyDigest} disabled={ws.mode === "demo"} />
      </CardBody>
    </Card>
  );
}

async function Billing({ ws, checkout }: { ws: Workspace; checkout?: string }) {
  const e = ws.entitlements;
  const current = PLANS.find((p) => p.id === e.plan)!;
  const live = stripeConfigured();
  const stripe = ws.mode === "app" ? await db.company.findUnique({ where: { id: ws.company.id }, select: { stripeCustomerId: true } }) : null;
  const rank = (id: string) => PLANS.findIndex((p) => p.id === id);
  return (
    <>
      {checkout === "success" && <FormMessage tone="success">Thanks! Your subscription is active. It can take a few seconds to show here.</FormMessage>}
      {checkout === "cancelled" && <FormMessage tone="info">Checkout was cancelled. Your plan hasn&apos;t changed.</FormMessage>}
      {checkout === "changed" && <FormMessage tone="success">Your plan is changing. Stripe prorates the difference; the new plan shows here within a few seconds.</FormMessage>}
      <Card>
        <CardHeader title="Your plan" />
        <CardBody>
          <p className="text-2xl font-heavy tracking-tight text-ink">
            {ws.mode === "demo" ? "Demo" : current.name}
            {e.trialActive && <span className="ml-2 align-middle text-sm font-normal text-muted">· Pro trial, {e.trialDaysLeft} days left</span>}
          </p>
          <p className="mt-1 text-[15px] text-ink-2">{e.trialActive ? "You have every Pro feature until your trial ends. Then you'll move to Free unless you upgrade." : current.tagline}</p>
          {!live && ws.mode === "app" && <p className="mt-3 text-sm text-muted">Online payments aren&apos;t switched on in this environment yet, so upgrades are disabled.</p>}
          {ws.mode === "app" && stripe?.stripeCustomerId && live && (
            <div className="mt-4">
              <PortalButton />
            </div>
          )}
        </CardBody>
      </Card>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const isCurrent = ws.mode === "app" && p.id === e.plan;
          return (
            <li key={p.id} className={cn("flex flex-col rounded-2xl border bg-surface p-5", isCurrent ? "border-ink" : "border-line")}>
              <div className="flex items-center justify-between">
                <p className="font-heavy text-ink">{p.name}</p>
                {isCurrent && <Badge tone="ink">Current</Badge>}
              </div>
              <p className="mt-3 text-3xl font-heavy tracking-tighter text-ink">
                {p.price === null ? "Custom" : `$${p.price}`}
                {p.price !== null && <span className="text-sm font-normal text-muted">/mo</span>}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {ws.mode === "demo" ? (
                  <ButtonLink href="/signup" variant="secondary" size="sm" className="w-full">
                    Start free trial
                  </ButtonLink>
                ) : p.id === "ENTERPRISE" ? (
                  <ButtonLink href="mailto:sales@pivot.app?subject=PIVOT%20Enterprise" variant="secondary" size="sm" className="w-full">
                    Talk to sales
                  </ButtonLink>
                ) : p.id === "FREE" || isCurrent ? null : ws.role === "OWNER" ? (
                  <PlanButton plan={p.id} label={`${rank(p.id) > rank(e.plan) ? "Upgrade" : "Switch"} to ${p.name}`} variant={p.id === "PRO" ? "primary" : "secondary"} />
                ) : (
                  <p className="text-xs text-muted">Only the workspace owner can change plans.</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
