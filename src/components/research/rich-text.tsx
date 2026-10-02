import type { ReactNode } from "react";

/**
 * Minimal, safe Markdown subset for assistant answers: paragraphs, bullet and
 * numbered lists, **bold** and ### headings. Builds React elements only (no
 * innerHTML), so model output can never inject markup.
 */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
}

export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter(Boolean);
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        if (/^#{1,4}\s/.test(lines[0])) {
          return (
            <div key={i}>
              <p className="font-semibold">{inline(lines[0].replace(/^#{1,4}\s+/, ""))}</p>
              {lines.slice(1).map((l, j) => (
                <p key={j}>{inline(l)}</p>
              ))}
            </div>
          );
        }
        return <p key={i}>{lines.flatMap((l, j) => (j ? [<br key={`b${j}`} />, ...inline(l)] : inline(l)))}</p>;
      })}
    </div>
  );
}
