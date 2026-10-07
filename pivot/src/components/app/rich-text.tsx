import { Fragment, type ReactNode } from "react";

/**
 * Renders a small, safe subset of Markdown from answers: paragraphs, numbered
 * or bulleted lines, and **bold**. Builds React elements (no HTML strings),
 * so model output can never inject markup.
 */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-heavy text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const m = line.match(/^\s*(?:(\d+)[.)]|[-•*])\s+(.*)$/);
        if (m) {
          return (
            <p key={i} className="flex gap-2">
              <span className="w-4 shrink-0 text-muted">{m[1] ? `${m[1]}.` : "•"}</span>
              <span>{inline(m[2])}</span>
            </p>
          );
        }
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}
