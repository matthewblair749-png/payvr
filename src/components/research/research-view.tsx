"use client";

/**
 * Research page: chat with the Research Assistant (main column) and the
 * "lumen noticed" insight feed + past conversations (side column).
 */
import { AnimatePresence, m } from "framer-motion";
import { ArrowUp, KeyRound, Loader2, MessageSquarePlus, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { dismissInsightAction, loadThreadAction, refreshInsightsAction } from "@/app/studio/research-actions";
import { LogoMark } from "@/components/brand/logo";
import type { DisplayMessage, ResearchEvent } from "@/server/research/agent";
import type { ProposalView } from "@/server/research/proposals";
import { ProposalCard } from "./proposal-card";
import { RichText } from "./rich-text";

export type InsightView = { id: string; kind: string; title: string; body: string; proposal: ProposalView | null };
type Thread = { id: string; title: string; updatedAt: string };

const SUGGESTIONS = [
  "Why did conversions drop on Tuesday?",
  "Should I price the mug set at $52 or $58?",
  "What's stopping people from buying?",
  "Which payment methods should I offer in Germany?",
  "Is variant B actually winning?",
];

const rel = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(mins) < 60) return rel.format(mins, "minute");
  const h = Math.round(mins / 60);
  return Math.abs(h) < 24 ? rel.format(h, "hour") : rel.format(Math.round(h / 24), "day");
}

export function ResearchView({
  insights: initialInsights,
  threads: initialThreads,
  enabled,
  initialThreadId = null,
  initialQuestion = "",
}: {
  insights: InsightView[];
  threads: Thread[];
  enabled: boolean;
  /** Open this conversation on arrival (from ⌘K search). */
  initialThreadId?: string | null;
  /** Prefill the question box (from ⌘K "Ask lumen"). */
  initialQuestion?: string;
}) {
  // Server props are the source of truth (refresh re-renders them); we only track local dismissals.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const insights = initialInsights.filter((i) => !dismissed.has(i.id));
  const [threads, setThreads] = useState(initialThreads);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState(initialQuestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    setBusy(true);
    setMessages((ms) => [...ms, { role: "user", text: q }, { role: "assistant", text: "", steps: [], proposals: [] }]);

    const patchLast = (fn: (a: Extract<DisplayMessage, { role: "assistant" }>) => void) =>
      setMessages((ms) => {
        const copy = ms.slice();
        const last = { ...(copy[copy.length - 1] as Extract<DisplayMessage, { role: "assistant" }>) };
        last.steps = [...last.steps];
        last.proposals = [...last.proposals];
        fn(last);
        copy[copy.length - 1] = last;
        return copy;
      });

    abort.current = new AbortController();
    try {
      const res = await fetch("/api/research/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId, message: q }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Couldn't reach the assistant.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as ResearchEvent;
          if (e.type === "thread") {
            setThreadId(e.threadId);
            setThreads((ts) => [{ id: e.threadId, title: e.title, updatedAt: new Date().toISOString() }, ...ts.filter((t) => t.id !== e.threadId)]);
          } else if (e.type === "text") patchLast((a) => void (a.text += e.delta));
          else if (e.type === "tool") patchLast((a) => void (a.steps.includes(e.label) || a.steps.push(e.label)));
          else if (e.type === "proposal") patchLast((a) => void a.proposals.push(e.proposal));
          else if (e.type === "error") setError({ message: e.message, code: e.code });
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError({ message: (e as Error).message });
    } finally {
      setBusy(false);
      // Drop an empty assistant bubble (e.g. when the request errored immediately).
      setMessages((ms) => {
        const last = ms[ms.length - 1];
        return last?.role === "assistant" && !last.text && !last.steps.length ? ms.slice(0, -1) : ms;
      });
    }
  }

  async function openThread(id: string) {
    if (busy) return;
    const res = await loadThreadAction({ threadId: id });
    if (!res.ok) return setError({ message: res.error });
    setThreadId(id);
    setMessages(res.data);
    setError(null);
  }

  // Deep link from search: open the requested conversation once.
  const opened = useRef(false);
  useEffect(() => {
    if (!initialThreadId || opened.current) return;
    opened.current = true;
    void loadThreadAction({ threadId: initialThreadId }).then((res) => {
      if (!res.ok) return setError({ message: res.error });
      setThreadId(initialThreadId);
      setMessages(res.data);
    });
  }, [initialThreadId]);

  function newThread() {
    abort.current?.abort();
    setThreadId(null);
    setMessages([]);
    setError(null);
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ------------------------------------------------ Chat */}
      <section aria-label="Research Assistant" className="flex h-[calc(100dvh-14rem)] min-h-[560px] flex-col overflow-hidden rounded-[28px] bg-white shadow-soft ring-1 ring-black/5">
        <div ref={scroller} className="flex-1 space-y-6 overflow-y-auto p-6" aria-live="polite" aria-busy={busy}>
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <LogoMark size={56} title="" />
              <h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.04em]">Ask anything about your checkouts</h2>
              <p className="mt-2 max-w-md text-muted-strong">
                Answers come from your own data: visits, payments, drop-offs and what buyers told you. When a change is worth testing,
                you can start it in one click.
              </p>
              {!enabled && <NoKeyNotice />}
              <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!enabled}
                    onClick={() => ask(s)}
                    className="rounded-full border border-black/12 px-4 py-2 text-sm font-medium hover:border-ink hover:bg-surface/60 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <div key={i} className="ml-auto w-fit max-w-[80%] rounded-3xl rounded-br-lg bg-ink px-5 py-3 text-white">
                {msg.text}
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <LogoMark size={32} title="" className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-3">
                  {msg.steps.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="What the assistant checked">
                      {msg.steps.map((s) => (
                        <li key={s} className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted-strong">
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                  {msg.text ? (
                    <RichText text={msg.text} />
                  ) : (
                    busy &&
                    i === messages.length - 1 && (
                      <p className="flex items-center gap-2 text-sm text-muted-strong">
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Looking into it…
                      </p>
                    )
                  )}
                  {msg.proposals.map((p) => (
                    <ProposalCard key={p.insightId} proposal={p} />
                  ))}
                </div>
              </div>
            ),
          )}
          {error && (
            <div role="alert" className="rounded-2xl bg-surface px-4 py-3 text-sm">
              {error.code === "no_api_key" ? <NoKeyNotice inline /> : error.message}
            </div>
          )}
        </div>

        <form
          className="border-t border-black/8 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl bg-surface/70 p-2 focus-within:ring-2 focus-within:ring-ink">
            <label htmlFor="research-input" className="sr-only">
              Ask the Research Assistant
            </label>
            <textarea
              id="research-input"
              rows={1}
              value={input}
              maxLength={2000}
              disabled={!enabled}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              placeholder={enabled ? "Why did conversions drop on Tuesday?" : "Add an Anthropic API key to chat"}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!enabled || busy || input.trim().length < 2}
              aria-label="Send"
              className="grid h-10 w-10 place-items-center rounded-xl bg-orange text-[#0e0e10] disabled:opacity-40"
            >
              {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}
            </button>
          </div>
        </form>
      </section>

      {/* ------------------------------------------------ Side column */}
      <aside className="space-y-6" aria-label="Insights and conversations">
        <section aria-labelledby="noticed" className="keep-dark rounded-[28px] bg-ink p-5 text-white">
          <div className="flex items-center justify-between">
            <h2 id="noticed" className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.03em]">
              <Sparkles size={18} className="text-spark" aria-hidden="true" /> lumen noticed
            </h2>
            <button
              type="button"
              onClick={() =>
                startRefresh(async () => {
                  await refreshInsightsAction();
                })
              }
              disabled={refreshing}
              aria-label="Refresh insights"
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"
            >
              <RefreshCw size={15} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <AnimatePresence initial={false}>
              {insights.length === 0 && <p className="text-sm text-white/70">Nothing unusual right now. Check back once more buyers come through.</p>}
              {insights.map((ins) => (
                <m.article
                  key={ins.id}
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl bg-white/[0.06] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{ins.title}</h3>
                    <button
                      type="button"
                      aria-label={`Dismiss: ${ins.title}`}
                      onClick={() => {
                        setDismissed((d) => new Set(d).add(ins.id));
                        void dismissInsightAction({ insightId: ins.id });
                      }}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/80">{ins.body}</p>
                  {ins.proposal && (
                    <div className="mt-3">
                      <ProposalCard proposal={ins.proposal} tone="dark" />
                    </div>
                  )}
                  {enabled && (
                    <button
                      type="button"
                      onClick={() => {
                        newThread();
                        void ask(`Tell me more about this: ${ins.title}`);
                      }}
                      className="mt-2 text-xs font-semibold text-spark underline-offset-4 hover:underline"
                    >
                      Ask about this
                    </button>
                  )}
                </m.article>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <section aria-labelledby="threads" className="rounded-[28px] bg-white p-5 shadow-soft ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h2 id="threads" className="font-display text-lg font-bold tracking-[-0.03em]">
              Conversations
            </h2>
            <button type="button" onClick={newThread} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-surface">
              <MessageSquarePlus size={15} aria-hidden="true" /> New
            </button>
          </div>
          <ul className="mt-3 space-y-1">
            {threads.length === 0 && <li className="text-sm text-muted-strong">No conversations yet.</li>}
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openThread(t.id)}
                  aria-current={t.id === threadId || undefined}
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-surface aria-[current]:bg-surface"
                >
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-strong">{ago(t.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function NoKeyNotice({ inline = false }: { inline?: boolean }) {
  return (
    <div className={`flex items-start gap-3 text-left ${inline ? "" : "mt-6 max-w-md rounded-2xl bg-surface p-4"}`}>
      <KeyRound size={18} className="mt-0.5 shrink-0 text-orange-deep" aria-hidden="true" />
      <p className="text-sm">
        <span className="font-semibold">Chat needs an Anthropic API key.</span> Set <code className="rounded bg-white px-1">ANTHROPIC_API_KEY</code> and
        restart. The insights on the right work without it.
      </p>
    </div>
  );
}
