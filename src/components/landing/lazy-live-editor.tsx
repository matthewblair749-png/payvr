"use client";

/**
 * The live editor is the heaviest thing on the landing page and sits below the
 * fold, so it loads when the visitor scrolls near it instead of competing with
 * the hero for the main thread.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const LiveEditor = dynamic(() => import("./live-editor").then((m) => m.LiveEditor), {
  ssr: false,
  loading: () => <Placeholder />,
});

function Placeholder() {
  return (
    <div
      role="status"
      aria-label="Loading the live checkout editor"
      className="min-h-[640px] animate-pulse rounded-[28px] bg-white/60 ring-1 ring-black/5 motion-reduce:animate-none"
    />
  );
}

export function LazyLiveEditor() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref}>{near ? <LiveEditor /> : <Placeholder />}</div>;
}
