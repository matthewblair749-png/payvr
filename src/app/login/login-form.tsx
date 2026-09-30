"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { requestMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestMagicLink, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="block text-sm font-semibold">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        placeholder="you@yourbrand.com"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "email-error" : undefined}
        className="w-full rounded-2xl border border-black/15 bg-white px-4 py-3.5 text-lg focus:border-ink focus:outline-none"
      />
      {state.error && (
        <p id="email-error" role="alert" className="text-sm font-medium text-orange-deep">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="group flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 text-lg font-semibold text-white transition-transform duration-200 ease-[var(--ease-spring)] hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
        <ArrowRight size={18} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
      </button>
    </form>
  );
}
