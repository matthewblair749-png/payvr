"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { CreditCard, LayoutTemplate, MessageCircleQuestion, Search, Sparkles, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NAV } from "./nav";

type Hit = { kind: "page" | "payment" | "customer" | "question"; id: string; title: string; detail: string; href: string };

const GROUPS: { kind: Hit["kind"]; heading: string; icon: typeof Search }[] = [
  { kind: "payment", heading: "Payments", icon: CreditCard },
  { kind: "customer", heading: "Customers", icon: User },
  { kind: "page", heading: "Checkout pages", icon: LayoutTemplate },
  { kind: "question", heading: "Questions you've asked", icon: MessageCircleQuestion },
];

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** The top bar's search field. Opens the palette; ⌘K / Ctrl+K and "/" do too. */
export function SearchTrigger({ onOpen, mac }: { onOpen: () => void; mac: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
      className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-control border border-app-hairline bg-app-card px-3 text-left text-ui text-app-muted hover:border-app-muted sm:max-w-md"
    >
      <Search size={16} aria-hidden="true" className="shrink-0" />
      <span className="truncate">
        Search<span className="max-sm:hidden"> payments, customers, pages…</span>
      </span>
      <kbd className="ml-auto hidden shrink-0 rounded-[6px] border border-app-hairline px-1.5 font-sans text-cap text-app-muted sm:block">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim(), 150);
  // Controlled highlight, reset to the first row whenever the term changes, so
  // Enter always does something (results arrive async and would otherwise
  // leave nothing selected).
  const [pick, setPick] = useState<{ term: string; value: string }>({ term: "", value: "" });
  const firstValue = term ? `ask:${term}` : `nav:${NAV[0].href}`;
  const selected = pick.term === term && pick.value ? pick.value : firstValue;

  // Global shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal() picks its own focus target; the search box must win.
      input.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", term],
    enabled: open && term.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<Hit[]> => {
      const res = await fetch(`/api/app/search?q=${encodeURIComponent(term)}`, { signal });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()).hits;
    },
  });
  const hits = term ? (data ?? []) : [];
  const navMatches = NAV.filter((n) => !term || n.label.toLowerCase().includes(term.toLowerCase()));

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Search lumen"
      onClose={() => onOpenChange(false)}
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
      className="m-0 mx-auto mt-[12vh] w-[min(640px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-card border border-app-hairline bg-app-card p-0 text-app-fg shadow-pop backdrop:bg-(--app-scrim)"
    >
      {open && (
        <Command
          label="Search lumen"
          shouldFilter={false}
          loop
          value={selected}
          onValueChange={(value) => setPick({ term, value })}
          className="flex max-h-[min(560px,70vh)] flex-col">
          <div className="flex items-center gap-3 border-b border-app-hairline px-4">
            <Search size={18} aria-hidden="true" className="shrink-0 text-app-muted" />
            <Command.Input
              ref={input}
              value={query}
              onValueChange={setQuery}
              placeholder="Search payments, customers, pages, or ask a question"
              className="h-14 min-w-0 flex-1 bg-transparent text-body text-app-fg outline-none placeholder:text-app-muted focus-visible:outline-none"
            />
            <kbd className="rounded-[6px] border border-app-hairline px-1.5 text-cap text-app-muted">Esc</kbd>
          </div>
          <Command.List className="overflow-y-auto p-2">
            {term && (
              <Command.Group heading="Ask lumen">
                <Item value={`ask:${term}`} onSelect={() => go(`/studio?ask=${encodeURIComponent(term)}`)} icon={Sparkles} accent>
                  <span className="truncate">“{term}”</span>
                  <Detail>Get a short answer from your data</Detail>
                </Item>
              </Command.Group>
            )}
            {GROUPS.map((g) => {
              const items = hits.filter((h) => h.kind === g.kind);
              if (!items.length) return null;
              return (
                <Command.Group key={g.kind} heading={g.heading}>
                  {items.map((h) => (
                    <Item key={`${h.kind}:${h.id}`} value={`${h.kind}:${h.id}`} onSelect={() => go(h.href)} icon={g.icon}>
                      <span className="truncate">{h.title}</span>
                      <Detail>{h.detail}</Detail>
                    </Item>
                  ))}
                </Command.Group>
              );
            })}
            {navMatches.length > 0 && (
              <Command.Group heading="Go to">
                {navMatches.map((n) => (
                  <Item key={n.href} value={`nav:${n.href}`} onSelect={() => go(n.href)} icon={n.icon}>
                    <span>{n.label}</span>
                  </Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          <div role="status" className="px-3 py-2 text-cap text-app-muted">
              {isError
                ? "Search isn't responding right now. Try again in a moment."
                : term && isFetching
                  ? "Searching…"
                  : term && data && hits.length === 0
                    ? `No payments, customers or pages match “${term}”. Try an email, an amount like 24.00, or a page name.`
                    : ""}
            </div>
        </Command>
      )}
    </dialog>
  );
}

function Item({
  value,
  onSelect,
  icon: Icon,
  accent,
  children,
}: {
  value: string;
  onSelect: () => void;
  icon: typeof Search;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-ui data-[selected=true]:bg-app-sunken"
    >
      <Icon size={16} aria-hidden="true" className={accent ? "shrink-0 text-app-accent" : "shrink-0 text-app-muted"} />
      <span className="flex min-w-0 flex-1 items-baseline gap-3">{children}</span>
    </Command.Item>
  );
}

function Detail({ children }: { children: ReactNode }) {
  return <span className="ml-auto shrink-0 truncate text-cap text-app-muted max-sm:hidden">{children}</span>;
}
