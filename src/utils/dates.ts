const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today" / "Yesterday" / "Mon, Sep 22" */
export function dayLabel(iso: string, now = new Date()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Short relative time for lists: "Just now", "5m", "3h", "Yesterday", "Sep 22". */
export function shortTime(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just now';
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)}m ago`;
  const label = dayLabel(iso, now);
  if (label === 'Today') return `${Math.floor(ms / (60 * 60_000))}h ago`;
  if (label === 'Yesterday') return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fullDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isToday(iso: string, now = new Date()) {
  return startOfDay(new Date(iso)) === startOfDay(now);
}
