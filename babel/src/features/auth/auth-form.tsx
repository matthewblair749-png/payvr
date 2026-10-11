import Link from "next/link";
import { Mascot } from "@/features/brand/mascot";
import { signInWithEmail, signInWithGoogle } from "./actions";
import { SubmitButton } from "./submit-button";

const ERRORS: Record<string, string> = {
  InvalidEmail: "That email address doesn't look right. Mind checking it?",
  EmailSignin: "We couldn't send the email just now. If you asked for a few links in a row, wait ten minutes and try again.",
  Verification: "That sign-in link has expired or was already used. Here's the form to get a fresh one.",
  OAuthAccountNotLinked: "That email is already linked to another sign-in method. Try the email link instead.",
  AccessDenied: "Sign-in was cancelled. Try again whenever you're ready.",
};
const FALLBACK_ERROR = "Something went wrong signing you in. Please try again.";

export function AuthForm({
  mode,
  callbackUrl,
  error,
  googleEnabled,
}: {
  mode: "signin" | "signup";
  callbackUrl: string;
  error?: string;
  googleEnabled: boolean;
}) {
  const signup = mode === "signup";
  const message = error ? (ERRORS[error] ?? FALLBACK_ERROR) : null;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mx-auto w-[96px]">
        <Mascot waving label="The Babel mascot, waving hello" />
      </div>
      <div className="mt-2 rounded-[var(--radius-lg)] border-2 border-ink bg-paper p-6 shadow-[0_6px_0_var(--ink)] sm:p-8">
        <h1 className="text-4xl">{signup ? "Make your account" : "Welcome back"}</h1>
        <p className="mt-3 text-muted">
          {signup
            ? "Free, no card needed. We'll email you a link: no password to remember."
            : "We'll email you a link to sign in. No password needed."}
        </p>

        {message && (
          <p role="alert" className="mt-5 rounded-[var(--radius)] bg-coral-tint px-4 py-3 font-semibold">
            {message}
          </p>
        )}

        <form action={signInWithEmail} className="mt-6 grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <input type="hidden" name="mode" value={mode} />
          <label htmlFor="email" className="font-display text-lg font-extrabold">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="min-h-12 rounded-[var(--radius)] border-2 border-line-strong bg-cream px-4 text-lg transition-colors duration-150 hover:border-ink focus-visible:border-ink"
          />
          <SubmitButton pendingLabel="Sending…" className="mt-2 w-full">
            Email me a link
          </SubmitButton>
        </form>

        {googleEnabled && (
          <>
            <div className="my-6 flex items-center gap-3 text-sm font-semibold text-muted" aria-hidden>
              <span className="h-px flex-1 bg-line-strong" /> or <span className="h-px flex-1 bg-line-strong" />
            </div>
            <form action={signInWithGoogle}>
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <SubmitButton variant="outline" pendingLabel="Opening Google…" className="w-full bg-white">
                <svg viewBox="0 0 18 18" className="size-5" aria-hidden>
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
                  <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
                </svg>
                Continue with Google
              </SubmitButton>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-muted">
        {signup ? "Already have an account? " : "New here? "}
        <Link
          href={`/${signup ? "signin" : "signup"}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-bold text-ink underline decoration-coral decoration-2 underline-offset-4 hover:decoration-ink"
        >
          {signup ? "Sign in" : "Make a free account"}
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-muted">
        By continuing you agree to how we handle data in our{" "}
        <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">
          privacy note
        </Link>
        .
      </p>
    </div>
  );
}
