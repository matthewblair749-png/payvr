"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { INDUSTRIES } from "@/lib/validation";
import { createCompany, login, requestPasswordReset, resetPassword, signup, type FormState } from "@/server/auth/actions";
import { PasswordInput } from "./password-input";
import { SubmitButton } from "./submit";

const aria = (state: FormState, k: string) =>
  state?.fieldErrors?.[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` } : {};

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage tone="error">{state?.error}</FormMessage>
      <Field id="name" label="Full name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" autoComplete="name" required maxLength={80} defaultValue={state?.values?.name} {...aria(state, "name")} />
      </Field>
      <Field id="email" label="Work email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} defaultValue={state?.values?.email} {...aria(state, "email")} />
      </Field>
      <Field id="password" label="Password" error={state?.fieldErrors?.password} hint="At least 10 characters. A short phrase works well.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} maxLength={200} {...aria(state, "password")} />
      </Field>
      <SubmitButton pendingLabel="Creating your account…">Create account</SubmitButton>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage tone="error">{state?.error}</FormMessage>
      <Field id="email" label="Email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} defaultValue={state?.values?.email} {...aria(state, "email")} />
      </Field>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="password" className="text-sm text-ink-2">
            Password
          </label>
          <Link href="/forgot-password" className="text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
            Forgot password?
          </Link>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" required maxLength={200} {...aria(state, "password")} />
        {state?.fieldErrors?.password && (
          <p id="password-error" className="mt-1.5 text-sm text-negative-text" role="alert">
            {state.fieldErrors.password}
          </p>
        )}
      </div>
      <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  if (state?.message) {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">{state.message}</FormMessage>
        {state.devLink && (
          <p className="rounded-xl border border-dashed border-line-strong p-3.5 text-sm text-muted">
            Development mode (no email server): <a href={state.devLink} className="break-all text-ink underline">open the reset link</a>.
          </p>
        )}
        <Link href="/login" className="block text-center text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
          Back to log in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage tone="error">{state?.error}</FormMessage>
      <Field id="email" label="Email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} defaultValue={state?.values?.email} {...aria(state, "email")} />
      </Field>
      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage tone="error">
        {state?.error}
        {state?.error && (
          <>
            {" "}
            <Link href="/forgot-password" className="underline">
              Request a new link
            </Link>
          </>
        )}
      </FormMessage>
      <Field id="password" label="New password" error={state?.fieldErrors?.password} hint="At least 10 characters.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} maxLength={200} {...aria(state, "password")} />
      </Field>
      <Field id="confirm" label="Confirm new password" error={state?.fieldErrors?.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required maxLength={200} {...aria(state, "confirm")} />
      </Field>
      <SubmitButton pendingLabel="Saving…">Set new password</SubmitButton>
    </form>
  );
}

export function CompanyForm() {
  const [state, action] = useActionState(createCompany, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage tone="error">{state?.error}</FormMessage>
      <Field id="name" label="Company name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" autoComplete="organization" placeholder="Acme Inc." required maxLength={80} defaultValue={state?.values?.name} {...aria(state, "name")} />
      </Field>
      <Field id="industry" label="Industry" error={state?.fieldErrors?.industry} hint="PIVOT uses this to pick sensible defaults for simulations.">
        <Select id="industry" name="industry" defaultValue={state?.values?.industry ?? "ecommerce"} {...aria(state, "industry")}>
          {INDUSTRIES.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton pendingLabel="Creating workspace…">Create workspace</SubmitButton>
    </form>
  );
}
