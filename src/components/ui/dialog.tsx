"use client";

/**
 * Accessible dialog built on the native <dialog> element: focus trapping,
 * Escape-to-close and the inert backdrop come from the browser for free.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  side = false,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Render as a right-hand sheet instead of a centered modal. */
  side?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className={cn(
        "max-h-[100dvh] bg-white p-0 text-ink shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]",
        side
          ? "fixed inset-y-0 right-0 left-auto m-0 h-dvh w-full max-w-md rounded-l-[28px]"
          : "m-auto w-[calc(100%-2rem)] max-w-lg rounded-[28px]",
        className,
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 p-6 pb-2">
            <div>
              <h2 id="dialog-title" className="font-display text-2xl font-bold tracking-[-0.04em]">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-muted-strong">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface hover:bg-black/10"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
