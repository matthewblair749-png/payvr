"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { CURRENCIES, INDUSTRIES } from "@/lib/validation";
import { openBillingPortal, startCheckout } from "@/server/billing/actions";
import { CompanyIdField, useCompanyId } from "./workspace-context";
import type { ActionResult } from "@/server/errors";
import {
  changePassword,
  inviteMember,
  updateAiSettings,
  updateCompany,
  updateNotifications,
  updateProfile,
  type SettingsState,
} from "@/server/settings-actions";

function Save({ pending, label = "Save changes", disabled }: { pending: boolean; label?: string; disabled?: boolean }) {
  return (
    <Button type="submit" variant="primary" disabled={pending || disabled}>
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {label}
    </Button>
  );
}

function Messages({ state }: { state: SettingsState }) {
  return (
    <>
      <FormMessage tone="error">{state?.error}</FormMessage>
      <FormMessage tone="success">{state?.ok ? state.message : null}</FormMessage>
    </>
  );
}

export function ProfileForm({ name, email, readOnly }: { name: string; email: string; readOnly: boolean }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="max-w-md space-y-4">
      <Messages state={state} />
      <Field id="name" label="Full name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={name} maxLength={80} disabled={readOnly} />
      </Field>
      <Field id="email" label="Email" hint="Contact support to change the email you sign in with.">
        <Input id="email" value={email} disabled readOnly />
      </Field>
      {!readOnly && <Save pending={pending} />}
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="max-w-md space-y-4">
      <Messages state={state} />
      <Field id="current" label="Current password" error={state?.fieldErrors?.current}>
        <PasswordInput id="current" name="current" autoComplete="current-password" maxLength={200} />
      </Field>
      <Field id="new" label="New password" error={state?.fieldErrors?.new} hint="At least 10 characters. Other devices will be signed out.">
        <PasswordInput id="new" name="new" autoComplete="new-password" maxLength={200} />
      </Field>
      <Save pending={pending} label="Change password" />
    </form>
  );
}

export function CompanyForm({
  company,
  timezones,
  readOnly,
}: {
  company: { name: string; industry: string; currency: string; timezone: string; marketSharePct: number | null };
  timezones: string[];
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(updateCompany, undefined);
  return (
    <form action={action} className="max-w-xl space-y-4">
      <CompanyIdField />
      <Messages state={state} />
      <Field id="name" label="Company name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={company.name} maxLength={80} disabled={readOnly} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="industry" label="Industry" error={state?.fieldErrors?.industry}>
          <Select id="industry" name="industry" defaultValue={company.industry} disabled={readOnly}>
            {INDUSTRIES.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="currency" label="Currency" error={state?.fieldErrors?.currency}>
          <Select id="currency" name="currency" defaultValue={company.currency} disabled={readOnly}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="timezone" label="Time zone" error={state?.fieldErrors?.timezone}>
        <Select id="timezone" name="timezone" defaultValue={company.timezone} disabled={readOnly}>
          {timezones.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field id="marketSharePct" label="Estimated market share (%)" error={state?.fieldErrors?.marketSharePct} hint="Optional. Lets What If? estimate market share changes.">
        <Input id="marketSharePct" name="marketSharePct" inputMode="decimal" defaultValue={company.marketSharePct ?? ""} placeholder="e.g. 12.5" disabled={readOnly} />
      </Field>
      {!readOnly && <Save pending={pending} />}
    </form>
  );
}

export function InviteForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(inviteMember, undefined);
  return (
    <form action={action} className="space-y-3">
      <CompanyIdField />
      <Messages state={state} />
      {state?.devLink && (
        <p className="rounded-xl border border-dashed border-line-strong p-3 text-sm text-muted">
          Development mode (no email server): <a href={state.devLink} className="break-all text-ink underline">invitation link</a>
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field id="invite-email" label="Email" error={state?.fieldErrors?.email}>
            <Input id="invite-email" name="email" type="email" placeholder="teammate@company.com" maxLength={254} disabled={disabled} />
          </Field>
        </div>
        <div className="sm:w-40">
          <Field id="invite-role" label="Role">
            <Select id="invite-role" name="role" defaultValue="MEMBER" disabled={disabled}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
        </div>
        <Save pending={pending} label="Send invite" disabled={disabled} />
      </div>
    </form>
  );
}

export function RowButton({ action, label, confirmText }: { action: () => Promise<SettingsState>; label: string; confirmText?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-negative-text">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          start(async () => {
            const r = await action();
            setError(r?.error ?? null);
          });
        }}
        className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-sunken hover:text-negative-text disabled:opacity-50"
      >
        {label}
      </button>
    </span>
  );
}

export function ToggleRow({ id, label, description, initial, kind, disabled }: { id: string; label: string; description: string; initial: boolean; kind: "ai" | "notifyDigest" | "notifyAlerts"; disabled?: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const companyId = useCompanyId();
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div>
        <label htmlFor={id} className="text-[15px] text-ink">
          {label}
        </label>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
        {error && <p className="mt-1 text-sm text-negative-text">{error}</p>}
      </div>
      <Switch
        id={id}
        checked={on}
        disabled={disabled || pending}
        onCheckedChange={(v) => {
          setOn(v);
          start(async () => {
            const r = kind === "ai" ? await updateAiSettings(companyId, v) : await updateNotifications(kind, v);
            if (r?.error) {
              setOn(!v);
              setError(r.error);
            } else setError(null);
          });
        }}
      />
    </div>
  );
}

export function PlanButton({ plan, label, variant }: { plan: "PRO" | "BUSINESS"; label: string; variant: "primary" | "secondary" | "accent" }) {
  const companyId = useCompanyId();
  const [state, action, pending] = useActionState<ActionResult | undefined>(() => startCheckout(companyId, plan), undefined);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant={variant} className="w-full" disabled={pending}>
        {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {label}
      </Button>
      {state && !state.ok && <FormMessage tone="info">{state.error}</FormMessage>}
    </form>
  );
}

export function PortalButton() {
  const companyId = useCompanyId();
  const [state, action, pending] = useActionState<ActionResult | undefined>(() => openBillingPortal(companyId), undefined);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        Manage billing
      </Button>
      {state && !state.ok && <FormMessage tone="info">{state.error}</FormMessage>}
    </form>
  );
}
