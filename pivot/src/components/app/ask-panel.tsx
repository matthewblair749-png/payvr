"use client";

import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { EXAMPLE_QUESTIONS } from "@/lib/engine/ask";
import { RichText } from "./rich-text";
import { useCompanyId } from "./workspace-context";

type Msg = { role: "user" | "assistant"; text: string; source?: "claude" | "engine"; error?: boolean };

/** Ask PIVOT: questions answered from this workspace's data only. */
export function AskPanel({ mode, companyName, seed, onClose }: { mode: "app" | "demo"; companyName: string; seed: string | null; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const companyId = useCompanyId();

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages]);
  // Closing the panel stops the answer, so the server stops generating it too. The abort waits a
  // tick: React's development StrictMode unmounts and remounts once on open, and that mustn't
  // cancel the question the panel was opened with.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current) controller.current?.abort();
      }, 0);
    };
  }, []);

  async function ask(question: string) {
    const q = question.trim().slice(0, 500);
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const history = messages.filter((m) => !m.error).slice(-6).map(({ role, text }) => ({ role, text: text.slice(0, 2000) }));
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "" }]);
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, history, mode, ...(mode === "app" ? { companyId } : {}) }), signal: ac.signal });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "PIVOT couldn't answer right now. Please try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { type: "text"; delta: string } | { type: "done"; source: "claude" | "engine" } | { type: "error"; message: string };
          setMessages((m) => {
            const copy = [...m];
            const last = { ...copy[copy.length - 1] };
            if (ev.type === "text") last.text += ev.delta;
            if (ev.type === "done") last.source = ev.source;
            if (ev.type === "error") {
              last.text = ev.message;
              last.error = true;
            }
            copy[copy.length - 1] = last;
            return copy;
          });
        }
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", text: e instanceof Error ? e.message : "PIVOT couldn't answer right now.", error: true };
        return copy;
      });
    } finally {
      if (controller.current === ac) controller.current = null;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (seed && !seeded.current) {
      seeded.current = true;
      void ask(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return (
    <Dialog open onClose={onClose} side title="Ask PIVOT" description={`Answers from ${companyName}'s data only.`}>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-5 px-6 py-5" aria-live="polite">
          {!messages.length && (
            <div>
              <p className="text-sm text-muted">Try asking:</p>
              <ul className="mt-3 space-y-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <li key={q}>
                    <button type="button" onClick={() => ask(q)} className="w-full rounded-xl border border-line px-3.5 py-2.5 text-left text-[15px] text-ink hover:border-ink/30 hover:bg-sunken">
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <p key={i} className="ml-8 rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-white">
                {m.text}
              </p>
            ) : (
              <div key={i} className="text-[15px] leading-relaxed text-ink-2">
                {m.text ? (
                  <div className={m.error ? "rounded-xl bg-negative-soft px-3.5 py-3 text-negative-text" : ""}>
                    <RichText text={m.text} />
                  </div>
                ) : (
                  <p className="inline-flex items-center gap-2 text-muted">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Reading your numbers…
                  </p>
                )}
                {m.source && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                    <Sparkles size={12} aria-hidden="true" />
                    {m.source === "claude" ? "Answered by Claude from your analysis" : "Answered by PIVOT's analysis engine"}
                  </p>
                )}
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="sticky bottom-0 border-t border-line bg-surface p-4"
        >
          <label htmlFor="ask-input" className="sr-only">
            Ask a question about your business
          </label>
          <div className="flex items-end gap-2 rounded-2xl border border-line-strong p-1.5 focus-within:border-ink">
            <textarea
              id="ask-input"
              rows={1}
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              placeholder="What should we focus on?"
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] text-ink placeholder:text-faint focus:outline-none"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-white disabled:opacity-30">
              {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">PIVOT only uses {mode === "demo" ? "the demo company's" : "your workspace's"} data, and says so when it can&apos;t answer.</p>
        </form>
      </div>
    </Dialog>
  );
}
