"use client";

import { m } from "framer-motion";
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutGrid, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { deleteHomeViewAction, saveHomeLayoutAction, saveHomeViewAction } from "@/app/studio/home-actions";
import { Card } from "@/components/app-shell/page-header";
import { DEFAULT_RANGE, parseRange, type RangeValue } from "@/lib/date-range";
import { DEFAULT_LAYOUT, type HomeLayout, type HomeView, move, sameLayout, type SectionKey, sectionLabel } from "@/lib/home-layout";
import { cn } from "@/lib/utils";

/**
 * Home's layout state: section order, hidden sections and saved views.
 * Changes show at once and save in the background (debounced).
 */
export function useHomeLayout(initialLayout: HomeLayout, initialViews: HomeView[]) {
  const [layout, setLayoutState] = useState(initialLayout);
  const [views, setViews] = useState(initialViews);
  const [saveError, setSaveError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function setLayout(next: HomeLayout) {
    setLayoutState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveHomeLayoutAction(next).then(
        () => setSaveError(false),
        () => setSaveError(true),
      );
    }, 500);
  }
  return { layout, setLayout, views, setViews, saveError };
}
export type LayoutState = ReturnType<typeof useHomeLayout>;

function useRangeParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const range = parseRange(params.get("range"));
  const setRange = (value: RangeValue) => {
    if (value === range) return;
    const next = new URLSearchParams(params.toString());
    if (value === DEFAULT_RANGE) next.delete("range");
    else next.set("range", value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return { range, setRange };
}

/** The row above Home's cards: saved views and the Customize switch. */
export function HomeToolbar({ state, editing, onEdit }: { state: LayoutState; editing: boolean; onEdit: (v: boolean) => void }) {
  const { range, setRange } = useRangeParam();
  const current = state.views.find((v) => v.range === range && sameLayout(v, state.layout));
  const isDefault = range === DEFAULT_RANGE && sameLayout(state.layout, DEFAULT_LAYOUT);
  const selectId = useId();

  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
      {state.views.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-ui text-app-muted">
            View
          </label>
          <select
            id={selectId}
            value={current?.id ?? (isDefault ? "default" : "custom")}
            onChange={(e) => {
              const v = state.views.find((x) => x.id === e.target.value);
              if (e.target.value === "default") {
                state.setLayout(DEFAULT_LAYOUT);
                setRange(DEFAULT_RANGE);
              } else if (v) {
                state.setLayout({ order: v.order, hidden: v.hidden });
                setRange(v.range);
              }
            }}
            className="h-9 rounded-control border border-app-hairline bg-app-card px-2 text-ui font-medium text-app-fg"
          >
            <option value="default">Default</option>
            {state.views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
            {!current && !isDefault && (
              <option value="custom" disabled>
                Unsaved changes
              </option>
            )}
          </select>
        </div>
      )}
      <button
        type="button"
        aria-expanded={editing}
        aria-controls="home-customize"
        onClick={() => onEdit(!editing)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-control border px-3 text-ui font-semibold",
          editing ? "border-app-fg bg-app-fg text-app-page" : "border-app-hairline bg-app-card hover:bg-app-page",
        )}
      >
        <LayoutGrid size={16} aria-hidden="true" />
        {editing ? "Done" : "Customize"}
      </button>
    </div>
  );
}

/** Reorder, hide and save views. Every control is a real button, so it all works from the keyboard. */
export function CustomizePanel({ state, onDone }: { state: LayoutState; onDone: () => void }) {
  const { range } = useRangeParam();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [announce, setAnnounce] = useState("");
  const nameId = useId();
  const { layout } = state;

  function moveSection(k: SectionKey, by: -1 | 1) {
    const next = move(layout, k, by);
    state.setLayout(next);
    const pos = next.order.indexOf(k) + 1;
    setAnnounce(`${sectionLabel(k)} moved to position ${pos} of ${next.order.length}.`);
    // Keep focus on the same button as the row moves; if it hit the end, use the other arrow.
    requestAnimationFrame(() => {
      const atEdge = (by === -1 && pos === 1) || (by === 1 && pos === next.order.length);
      document.getElementById(`move-${k}-${atEdge ? -by : by}`)?.focus();
    });
  }

  function toggle(k: SectionKey) {
    const hidden = layout.hidden.includes(k) ? layout.hidden.filter((h) => h !== k) : [...layout.hidden, k];
    if (hidden.length === layout.order.length) {
      setAnnounce("Keep at least one section on Home.");
      return;
    }
    state.setLayout({ ...layout, hidden });
    setAnnounce(`${sectionLabel(k)} ${hidden.includes(k) ? "hidden" : "shown"}.`);
  }

  return (
    <Card id="home-customize" aria-labelledby="customize-title" className="mt-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="customize-title" className="text-ui font-semibold">
          Customize Home
        </h2>
        <p className="text-cap text-app-muted">Changes save automatically and only change what you see.</p>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <ol className="mt-4 divide-y divide-app-hairline rounded-control border border-app-hairline">
        {layout.order.map((k, i) => {
          const hidden = layout.hidden.includes(k);
          return (
            <m.li key={k} layout="position" transition={{ duration: 0.18 }} className="flex items-center gap-3 px-3 py-2">
              <span className="w-5 text-right text-cap tabular-nums text-app-muted" aria-hidden="true">
                {i + 1}
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-ui", hidden ? "text-app-muted line-through" : "font-medium")}>
                {sectionLabel(k)}
                {hidden && <span className="sr-only"> (hidden)</span>}
              </span>
              <IconButton id={`move-${k}--1`} label={`Move ${sectionLabel(k)} up`} disabled={i === 0} onClick={() => moveSection(k, -1)}>
                <ArrowUp size={16} />
              </IconButton>
              <IconButton
                id={`move-${k}-1`}
                label={`Move ${sectionLabel(k)} down`}
                disabled={i === layout.order.length - 1}
                onClick={() => moveSection(k, 1)}
              >
                <ArrowDown size={16} />
              </IconButton>
              <button
                type="button"
                aria-pressed={!hidden}
                onClick={() => toggle(k)}
                className="inline-flex h-8 w-20 items-center justify-center gap-1.5 rounded-control border border-app-hairline text-cap font-semibold hover:bg-app-page"
              >
                {hidden ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                {hidden ? "Hidden" : "Shown"}
                <span className="sr-only"> {sectionLabel(k)}</span>
              </button>
            </m.li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={sameLayout(layout, DEFAULT_LAYOUT)}
          onClick={() => {
            state.setLayout(DEFAULT_LAYOUT);
            setAnnounce("Home is back to the default layout.");
          }}
          className="text-ui font-semibold text-app-fg underline underline-offset-4 disabled:text-app-muted disabled:no-underline"
        >
          Reset to default
        </button>
        {state.saveError && (
          <p role="alert" className="text-ui text-app-failure-text">
            Your layout didn&apos;t save. It&apos;s still applied here; try another change in a moment.
          </p>
        )}
      </div>

      <form
        className="mt-6 border-t border-app-hairline pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveHomeViewAction({ name, range, layout }).catch(() => ({ ok: false as const, error: "That didn't save. Try again." }));
            if (!r.ok) return setMessage({ ok: false, text: r.error });
            state.setViews(r.views);
            setName("");
            setMessage({ ok: true, text: `Saved “${r.view.name}”. Switch to it from View at any time.` });
          });
        }}
      >
        <label htmlFor={nameId} className="text-ui font-semibold">
          Save as a view
        </label>
        <p className="text-cap text-app-muted">Keeps this order, the hidden sections and the date range together.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="e.g. Monday check-in"
            className="h-9 min-w-0 flex-1 rounded-control border border-app-hairline bg-app-card px-3 text-ui placeholder:text-app-muted"
          />
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="h-9 rounded-control border border-app-hairline bg-app-card px-3 text-ui font-semibold hover:bg-app-page disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save view"}
          </button>
        </div>
        <p role="status" className={cn("mt-2 min-h-5 text-cap", message?.ok === false ? "text-app-failure-text" : "text-app-muted")}>
          {message?.text}
        </p>
      </form>

      {state.views.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Saved views">
          {state.views.map((v) => (
            <li key={v.id} className="inline-flex items-center gap-1 rounded-full border border-app-hairline py-0.5 pl-3 pr-1 text-cap">
              {v.name}
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                onClick={() =>
                  start(async () => {
                    const r = await deleteHomeViewAction({ id: v.id }).catch(() => null);
                    if (r) state.setViews(r.views);
                    setMessage(r ? { ok: true, text: `Deleted “${v.name}”.` } : { ok: false, text: "That didn't delete. Try again." });
                  })
                }
                className="grid size-6 place-items-center rounded-full text-app-muted hover:bg-app-page hover:text-app-fg"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onDone} className="h-9 rounded-control bg-app-fg px-4 text-ui font-semibold text-app-page">
          Done
        </button>
      </div>
    </Card>
  );
}

function IconButton({ id, label, disabled, onClick, children }: { id: string; label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-control border border-app-hairline text-app-fg hover:bg-app-page disabled:opacity-35 [&_svg]:pointer-events-none"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
