"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ROOMS } from "@/config/rooms";
import { Mascot } from "@/features/brand/mascot";
import { isLanguageCode, LANGUAGES, type LanguageCode } from "@/features/translation/languages";
import type { Credentials } from "../client/storage";

/** The visitor's browser language, if Babel supports it. */
export function browserLanguage(): LanguageCode {
  if (typeof navigator === "undefined") return "en";
  const code = navigator.language.slice(0, 2).toLowerCase();
  return isLanguageCode(code) ? code : "en";
}

export function LanguageSelect({ id, value, onChange }: { id: string; value: LanguageCode; onChange: (l: LanguageCode) => void }) {
  return (
    <select
      id={id}
      name="language"
      value={value}
      onChange={(e) => onChange(e.target.value as LanguageCode)}
      className="min-h-12 w-full rounded-[var(--radius)] border-2 border-line-strong bg-cream px-3 text-lg hover:border-ink focus-visible:border-ink"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.native}
          {l.native !== l.name ? ` · ${l.name}` : ""}
        </option>
      ))}
    </select>
  );
}

export function JoinForm({
  roomId,
  roomName,
  onJoined,
}: {
  roomId: string;
  roomName: string;
  onJoined: (creds: Credentials) => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<LanguageCode>(browserLanguage);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { name: useId(), language: useId() };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, language }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; participantId?: string; token?: string };
      if (data.ok && data.participantId && data.token) onJoined({ participantId: data.participantId, token: data.token });
      else setError(data.message ?? "Couldn't join. Please try again.");
    } catch {
      setError("Couldn't reach Babel. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md py-8">
      <div className="mx-auto w-[96px]">
        <Mascot label="The Babel mascot, waving hello" />
      </div>
      <form onSubmit={submit} className="mt-2 grid gap-4 rounded-[var(--radius-lg)] border-2 border-ink bg-paper p-6 shadow-[0_6px_0_var(--ink)] sm:p-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-muted">You&rsquo;re invited to</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">{roomName}</h1>
          <p className="mt-3 text-muted">Write in your language. Everyone else reads it in theirs. No account needed.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-[var(--radius)] bg-coral-tint px-4 py-3 font-semibold">
            {error}
          </p>
        )}
        <div className="grid gap-2">
          <label htmlFor={ids.name} className="font-display text-lg font-extrabold">
            Your name
          </label>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={ROOMS.maxNameChars}
            autoComplete="nickname"
            placeholder="What should people call you?"
            className="min-h-12 rounded-[var(--radius)] border-2 border-line-strong bg-cream px-4 text-lg hover:border-ink focus-visible:border-ink"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor={ids.language} className="font-display text-lg font-extrabold">
            Your language
          </label>
          <LanguageSelect id={ids.language} value={language} onChange={setLanguage} />
        </div>
        <Button type="submit" disabled={busy} className="mt-2 w-full">
          {busy ? "Joining…" : "Join the room"}
        </Button>
        <p className="text-sm text-muted">Messages are deleted when the room closes.</p>
      </form>
    </div>
  );
}
