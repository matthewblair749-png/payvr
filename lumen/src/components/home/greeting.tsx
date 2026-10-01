'use client';

import { useMounted } from '@/lib/html-attr';

const partOfDay = (h: number) => (h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

/** Time-aware greeting. Uses the clock only after hydration so static HTML never disagrees with it. */
export function Greeting({ name }: { name: string }) {
  const mounted = useMounted();
  const now = new Date();
  const hello = mounted ? partOfDay(now.getHours()) : 'Welcome back';
  const date = mounted ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  return (
    <div>
      <p className="h-5 text-sm text-muted">{date}</p>
      <h1 className="mt-1 font-display text-xl font-bold tracking-[-0.02em] text-text">
        {hello}, {name}
      </h1>
    </div>
  );
}
