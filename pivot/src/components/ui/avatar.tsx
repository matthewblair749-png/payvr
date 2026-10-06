import { cn, initials } from "@/lib/utils";

// Muted, enterprise tones (no accent blue): navy, slate, plum, teal, olive, clay.
const TONES = ["#1b2a4a", "#3f4a5e", "#5a3e5d", "#1f5257", "#4d5631", "#6b4433"];

function toneFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-heavy text-white", className)}
      style={{ width: size, height: size, backgroundColor: toneFor(name), fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
