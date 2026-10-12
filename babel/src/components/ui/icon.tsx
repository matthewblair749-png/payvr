import clsx from "clsx";

/**
 * Babel's icon set. One grid (24), one stroke (1.75), round caps and joins,
 * so every icon in the product reads as the same hand. Decorative by
 * default: pair with visible text, or pass `label` for icon-only controls.
 */
const PATHS = {
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  close: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5 9.5 17 19 7.5",
  copy: "M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM16 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2",
  mic: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21",
  send: "M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4Z",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1-1",
  users: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c1.8.8 3 2.6 3 4.6",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z",
  sparkle: "M12 3.5 13.9 9l5.6 2-5.6 2L12 18.5 10.1 13l-5.6-2 5.6-2Z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z",
  monitor: "M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 21h6M12 17v4",
  command: "M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z",
  search: "M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.4-4.4",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  volume: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5ZM16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  volumeOff: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5ZM16.5 9.5l5 5M21.5 9.5l-5 5",
  share: "M12 3.5v11M7.5 8 12 3.5 16.5 8M5 13v5a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18v-5",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  refresh: "M20 11.5a8 8 0 1 1-2.3-5.6M20 4v5h-5",
  wifiOff: "M3 3l18 18M8.6 16.4a5 5 0 0 1 6.8 0M5.2 12.8a10 10 0 0 1 4-2.4M18.8 12.8a10 10 0 0 0-2.3-1.6M2 9.2a14.5 14.5 0 0 1 3.6-2.4M22 9.2A14.5 14.5 0 0 0 11 5.7M12 20h.01",
  alert: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5v5.5M12 16.5h.01",
  keyboard: "M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM7 10h.01M11 10h.01M15 10h.01M17 14H7",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5",
  card: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM3 10h18M7 15h3",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10",
  menu: "M4 7h16M4 12h16M4 17h16",
  palette: "M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3.5-3.8 3.5h-2.1a1.6 1.6 0 0 0-1.2 2.7c.8.9.3 2.8-1.9 2.8ZM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01M17 11.5h.01",
  extension: "M9 4h4v2.5a1.5 1.5 0 0 0 3 0V4h3a1 1 0 0 1 1 1v4h-2.5a1.5 1.5 0 0 0 0 3H20v7a1 1 0 0 1-1 1h-7v-2.5a1.5 1.5 0 0 0-3 0V20H5a1 1 0 0 1-1-1v-6h2.5a1.5 1.5 0 0 0 0-3H4V5a1 1 0 0 1 1-1Z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  block: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8",
  external: "M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  label,
  className,
}: {
  name: IconName;
  size?: 16 | 20 | 24;
  /** Accessible name for icon-only use. Omit when visible text says the same. */
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={clsx("shrink-0", className)}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
