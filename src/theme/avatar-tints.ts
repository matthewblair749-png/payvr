import type { ColorScheme } from './colors';

/**
 * Soft, flat (no gradient) avatar colors so people are recognizable at a glance.
 * Each person always gets the same tint (hash of their name). Every pair passes
 * WCAG AA for the initials (checked in __tests__/contrast.test.ts).
 */
export const AvatarTints: Record<ColorScheme, { bg: string; fg: string }[]> = {
  dark: [
    { bg: '#16224D', fg: '#A9BDFF' }, // blue
    { bg: '#2A1D4D', fg: '#C8B5FF' }, // violet
    { bg: '#0F3336', fg: '#7FE0D6' }, // teal
    { bg: '#3A2A0E', fg: '#F5C66B' }, // amber
    { bg: '#3D1827', fg: '#FFA3C2' }, // rose
    { bg: '#12331F', fg: '#86E3A6' }, // green
  ],
  light: [
    { bg: '#E4EAFF', fg: '#1E3DB8' },
    { bg: '#EEE7FF', fg: '#5B2FC2' },
    { bg: '#DDF5F2', fg: '#0B6B63' },
    { bg: '#FDF0D5', fg: '#8A5A00' },
    { bg: '#FDE4EC', fg: '#A3264F' },
    { bg: '#DFF5E7', fg: '#17703A' },
  ],
};

export function tintFor(name: string, scheme: ColorScheme) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const list = AvatarTints[scheme];
  return list[h % list.length];
}
