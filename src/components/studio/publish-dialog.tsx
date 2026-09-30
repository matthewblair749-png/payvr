"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { publishAction, setSplitAction } from "@/app/studio/actions";
import { SuccessCheck } from "@/components/checkout/success-check";
import { RangeControl } from "@/components/editor/controls";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { VersionRow } from "./versions-dialog";

export function PublishDialog({
  open,
  onClose,
  pageId,
  slug: initialSlug,
  appUrl,
  hasVariant,
  weightB,
  onPublished,
  onSplitChange,
  flushSave,
}: {
  open: boolean;
  onClose: () => void;
  pageId: string;
  slug: string;
  appUrl: string;
  hasVariant: boolean;
  weightB: number;
  onPublished: (r: { slug: string; version: VersionRow }) => void;
  onSplitChange: (weightB: number) => void;
  /** Make sure pending autosaves land before we snapshot the draft. */
  flushSave: () => Promise<boolean>;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const splitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const host = appUrl.replace(/^https?:\/\//, "");
  const liveUrl = (s: string) => `${appUrl}/pay/${s}`;

  function publish(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      if (!(await flushSave())) return setError("Your latest changes haven't saved yet. Try again in a second.");
      const res = await publishAction({ pageId, slug });
      if (!res.ok) return setError(res.error);
      setError(null);
      setDone(res.data.slug);
      onPublished(res.data);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setDone(null);
      }}
      title={done ? "You're live" : "Publish checkout"}
      description={done ? undefined : "Buyers see the published version. Keep editing; nothing changes until you publish again."}
    >
      {done ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center" style={{ ["--co-accent" as string]: "#F04A1A", ["--co-accent-fg" as string]: "#fff" }}>
          <SuccessCheck size={64} />
          <p className="break-all font-mono text-sm">{liveUrl(done)}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(liveUrl(done));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={`/pay/${done}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-white">
              Open <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={publish} className="space-y-5">
          <div>
            <label htmlFor="slug" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Checkout link
            </label>
            <div className="flex items-center rounded-2xl border border-black/12 pl-4 focus-within:border-ink">
              <span className="shrink-0 text-sm text-muted-strong">{host}/pay/</span>
              <input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                maxLength={48}
                required
                pattern="[a-z0-9][a-z0-9\-]{1,46}[a-z0-9]"
                aria-describedby="slug-help"
                className="min-w-0 flex-1 bg-transparent py-3 pr-4 font-semibold focus:outline-none"
              />
            </div>
            <p id="slug-help" className="mt-1 text-xs text-muted-strong">
              Lowercase letters, numbers and dashes.
            </p>
          </div>

          {hasVariant && (
            <div className="rounded-2xl bg-surface/70 p-4">
              <RangeControl
                label="Traffic to variant B"
                value={weightB}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(w) => {
                  onSplitChange(w);
                  // Debounced: one request after the slider settles.
                  if (splitTimer.current) clearTimeout(splitTimer.current);
                  splitTimer.current = setTimeout(() => void setSplitAction({ pageId, weightB: w }), 400);
                }}
              />
              <p className="mt-2 text-xs text-muted-strong">
                Publishing starts the A/B test: {100 - weightB}% see A, {weightB}% see B. Each visitor always sees the same one.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-orange-deep">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
            {pending ? "Publishing…" : "Publish"}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
