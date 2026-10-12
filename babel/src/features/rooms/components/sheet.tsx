"use client";

import { useEffect, useRef } from "react";

/**
 * A modal sheet built on <dialog>: focus is trapped, Escape closes it, and
 * the page behind is inert. Slides up from the bottom on phones.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog itself, not its content) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
      className="m-0 mt-auto w-full max-w-none rounded-t-[var(--radius-xl)] border-2 border-ink bg-cream p-0 text-ink backdrop:bg-ink/50 sm:m-auto sm:max-w-md sm:rounded-[var(--radius-xl)]"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press flex size-11 items-center justify-center rounded-full border-2 border-ink bg-white hover:bg-paper active:scale-95"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M3 3l10 10M13 3 3 13" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
