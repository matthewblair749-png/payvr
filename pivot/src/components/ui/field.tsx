import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-faint transition-[border-color,box-shadow] focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/8 disabled:bg-sunken disabled:text-muted aria-[invalid=true]:border-negative aria-[invalid=true]:ring-negative/10";

export function Label({ htmlFor, children, className }: { htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-sm text-ink-2", className)}>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        control,
        "pv-select h-11 appearance-none pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-negative-text" role="alert">
      {children}
    </p>
  );
}

export function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-[13px] text-muted">
      {children}
    </p>
  );
}

/** Label + control + error, wired for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
    </div>
  );
}

/** Inline form-level message (success or error). */
export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children?: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-3.5 py-3 text-sm",
        tone === "error" ? "bg-negative-soft text-negative-text" : tone === "success" ? "bg-positive-soft text-positive-text" : "bg-sunken text-ink-2",
      )}
    >
      {children}
    </div>
  );
}
