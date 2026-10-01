"use client";

import { ArrowRight, ArrowUp, FlaskConical, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { startProposalAction } from "@/app/studio/research-actions";
import { parseRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import type { AskAnswer, AskEvent, AskStep } from "@/server/home/ask";
import { AskChart } from "./ask-chart";

const SUGGESTIONS = ["Where do people drop off?", "How much did I make this week?", "Mobile vs desktop?", "Where do my shoppers come from?"];

type State = { status: "idle" } | { status: "working"; question: string; steps: string[] } | { status: "done"; answer: AskAnswer } | { status: "error"; question: string; message: string };

/**
 * The docked question bar. Plain-English question in; a short answer, a small
 * chart, "How I calculated this" and maybe a one-click next step out.
 */
export function AskLumen({ currency }: { currency: string }) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = parseRange(params.get("range"));
  const panelId = useId();

  const submit = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (question.length < 2) return;
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setInput("");
      setState({ status: "working", question, steps: [] });
      try {
        const res = await fetch("/api/app/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question, range }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "lumen couldn't answer just now. Please try again.");
        }
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const e = JSON.parse(buf.slice(0, nl)) as AskEvent;
            buf = buf.slice(nl + 1);
            if (e.type === "step") setState((s) => (s.status === "working" ? { ...s, steps: [...s.steps, e.label] } : s));
            else if (e.type === "answer") setState({ status: "done", answer: e.answer });
            else setState({ status: "error", question, message: e.message });
          }
        }
        setState((s) => (s.status === "working" ? { status: "error", question, message: "The answer was cut off. Please try again." } : s));
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState({ status: "error", question, message: e instanceof Error ? e.message : "Something went wrong." });
      }
    },
    [range],
  );

  // Opened from the brief ("Ask lumen what to try") or ⌘K (?ask=…).
  useEffect(() => {
    const onAsk = (e: Event) => void submit((e as CustomEvent<{ question: string }>).detail.question);
    window.addEventListener("lumen:ask", onAsk);
    return () => window.removeEventListener("lumen:ask", onAsk);
  }, [submit]);
  const asked = params.get("ask");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!asked || handled.current === asked) return;
    handled.current = asked;
    void submit(asked.slice(0, 300));
    const next = new URLSearchParams(params.toString());
    next.delete("ask");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [asked, params, pathname, router, submit]);

  const close = () => {
    abort.current?.abort();
    setState({ status: "idle" });
    inputRef.current?.focus();
  };
  const open = state.status !== "idle";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 md:left-(--app-sidebar-collapsed) lg:left-(--app-sidebar) lg:group-data-[collapsed=true]/shell:left-(--app-sidebar-collapsed)">
      <div className="pointer-events-auto mx-auto max-w-2xl px-4 pb-4">
        {open && (
          <section
            id={panelId}
            aria-label="Ask lumen answer"
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="mb-2 max-h-[min(60vh,560px)] overflow-y-auto rounded-card border border-app-hairline bg-app-card p-5 shadow-pop"
          >
            <div className="flex items-start gap-3">
              <p className="min-w-0 flex-1 text-ui font-semibold text-app-muted">
                {state.status === "done" ? state.answer.question : state.question}
              </p>
              <button type="button" onClick={close} aria-label="Close answer" className="-m-1 grid size-8 shrink-0 place-items-center rounded-control text-app-muted hover:bg-app-sunken hover:text-app-fg">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div aria-live="polite">
              {state.status === "working" && (
                <ul className="mt-3 space-y-1.5 text-ui text-app-muted" role="status">
                  {(state.steps.length ? state.steps : ["Reading your numbers"]).map((s, i, all) => (
                    <li key={i} className="flex items-center gap-2">
                      <span aria-hidden="true" className={cn("size-1.5 rounded-full bg-app-muted", i === all.length - 1 && "motion-safe:animate-pulse")} />
                      {s}…
                    </li>
                  ))}
                </ul>
              )}
              {state.status === "error" && (
                <p role="alert" className="mt-3 text-body">
                  {state.message}
                </p>
              )}
              {state.status === "done" && <Answer answer={state.answer} currency={currency} />}
            </div>
          </section>
        )}

        {focused && !open && !input && (
          <ul className="mb-2 flex flex-wrap gap-2" aria-label="Suggested questions">
            {SUGGESTIONS.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void submit(q)}
                  className="rounded-full border border-app-hairline bg-app-card px-3 py-1.5 text-ui shadow-card hover:bg-app-sunken"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
          className="flex items-center gap-2 rounded-card border border-app-hairline bg-app-card py-2 pl-4 pr-2 shadow-pop focus-within:border-app-muted"
        >
          <Sparkles size={18} aria-hidden="true" className="shrink-0 text-app-muted" />
          <label htmlFor="ask-lumen" className="sr-only">
            Ask lumen a question about your shop
          </label>
          <input
            ref={inputRef}
            id="ask-lumen"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={300}
            autoComplete="off"
            placeholder="Ask lumen anything about your shop…"
            aria-controls={open ? panelId : undefined}
            className="h-9 min-w-0 flex-1 bg-transparent text-body text-app-fg outline-none placeholder:text-app-muted focus-visible:outline-none"
          />
          <button
            type="submit"
            aria-label="Ask"
            disabled={input.trim().length < 2 || state.status === "working"}
            className="grid size-9 shrink-0 place-items-center rounded-control bg-app-fg text-app-page disabled:opacity-30"
          >
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Minimal **bold** rendering for answers (no HTML from the model). */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

function Answer({ answer, currency }: { answer: AskAnswer; currency: string }) {
  return (
    <div className="mt-3">
      <p className="text-body leading-relaxed">
        <Rich text={answer.answer} />
      </p>
      {answer.chart && <AskChart chart={answer.chart} currency={currency} />}
      {answer.action && <NextAction action={answer.action} />}
      {answer.steps.length > 0 && <Method steps={answer.steps} source={answer.source} />}
    </div>
  );
}

function NextAction({ action }: { action: NonNullable<AskAnswer["action"]> }) {
  const [state, setState] = useState<{ status: "idle" | "busy" } | { status: "done"; id: string } | { status: "error"; message: string }>({ status: "idle" });
  const cls = "mt-4 inline-flex h-10 items-center gap-2 rounded-control px-4 text-ui font-semibold";
  if (action.kind === "link") {
    return (
      <Link href={action.href} className={cn(cls, "border border-app-hairline hover:bg-app-sunken")}>
        {action.label} <ArrowRight size={16} aria-hidden="true" />
      </Link>
    );
  }
  if (state.status === "done") {
    return (
      <Link href={`/studio/experiments/${state.id}`} className={cn(cls, "border border-app-hairline hover:bg-app-sunken")} role="status">
        <FlaskConical size={16} aria-hidden="true" /> Test started. See it <ArrowRight size={16} aria-hidden="true" />
      </Link>
    );
  }
  return (
    <div className="mt-4 rounded-control border border-app-hairline p-3">
      <p className="text-ui font-semibold">{action.proposal.title}</p>
      <p className="mt-0.5 text-cap text-app-muted">
        On {action.proposal.checkoutName}: {action.proposal.changes.join("; ")}. Half your shoppers see it until there&apos;s a clear answer.
      </p>
      <button
        type="button"
        disabled={state.status === "busy"}
        onClick={async () => {
          setState({ status: "busy" });
          const r = await startProposalAction({ insightId: action.proposal.insightId });
          setState(r.ok ? { status: "done", id: r.data.experimentId } : { status: "error", message: r.error });
        }}
        className={cn(cls, "mt-3 bg-app-accent text-app-accent-fg disabled:opacity-70")}
      >
        <FlaskConical size={16} aria-hidden="true" /> {state.status === "busy" ? "Starting…" : "Start a test"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-cap text-app-failure-text">
          {state.message}
        </p>
      )}
    </div>
  );
}

/** "How I calculated this": the queries that actually ran, their inputs and their rows. */
function Method({ steps, source }: { steps: AskStep[]; source: AskAnswer["source"] }) {
  return (
    <details className="group mt-4 border-t border-app-hairline pt-3">
      <summary className="cursor-pointer rounded-control text-ui font-semibold text-app-muted hover:text-app-fg">How I calculated this</summary>
      <ol className="mt-3 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="text-ui">
            <p className="font-semibold">
              {i + 1}. {s.label}
            </p>
            <p className="mt-0.5 text-app-muted">{s.logic}</p>
            {Object.keys(s.input).length > 0 && (
              <p className="mt-1 text-cap text-app-muted">
                Using: {Object.entries(s.input).map(([k, v]) => `${k.replace(/_/g, " ")} ${String(v)}`).join(" · ")}
              </p>
            )}
            <DataTable rows={s.rows} total={s.totalRows} />
          </li>
        ))}
      </ol>
      <p className="mt-3 text-cap text-app-muted">
        {source === "ai" ? "lumen's AI chose these queries; every number in the answer comes from the rows above." : "Answered directly from these queries."}
      </p>
    </details>
  );
}

function cell(v: unknown): ReactNode {
  if (v == null) return "–";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function DataTable({ rows, total }: { rows: Record<string, unknown>[]; total: number }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]).filter((k) => rows.some((r) => typeof r[k] !== "object" || r[k] === null)).slice(0, 6);
  const shown = all ? rows : rows.slice(0, 8);
  return (
    <div className="mt-2 overflow-x-auto rounded-control border border-app-hairline">
      <table className="w-full text-left text-cap">
        <thead className="text-app-muted">
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap px-2 py-1.5 font-semibold">
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i} className="border-t border-app-hairline">
              {cols.map((c) => (
                <td key={c} className="whitespace-nowrap px-2 py-1">
                  {cell(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 8 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="w-full border-t border-app-hairline px-2 py-1 text-cap font-semibold text-app-muted hover:text-app-fg">
          {all ? "Show fewer rows" : `Show all ${total} rows`}
        </button>
      )}
    </div>
  );
}
