export type ColorScheme = 'dark' | 'light';
export type ThemePreference = ColorScheme | 'system';

export type Palette = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  /** Brand blue for filled buttons. Always paired with `onPrimary`. */
  primary: string;
  onPrimary: string;
  /** Blue used for text and icons sitting on `background` / `surface`. */
  accent: string;
  /** Success for icons and large text (e.g. big amounts, checkmarks). */
  success: string;
  /** Success for small text; slightly deeper in light mode to meet WCAG AA 4.5:1. */
  successText: string;
  error: string;
  /** Translucent brand blue for the tap-screen rings. */
  ring: string;
};

export const Colors: Record<ColorScheme, Palette> = {
  dark: {
    background: '#000000',
    surface: '#141414',
    border: '#262626',
    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    primary: '#2150FF',
    onPrimary: '#FFFFFF',
    accent: '#5B82FF',
    success: '#22C55E',
    successText: '#22C55E',
    error: '#EF4444',
    ring: '#2150FF',
  },
  light: {
    background: '#FFFFFF',
    surface: '#F3F6FF',
    border: '#E3E8F5',
    text: '#0A0A0A',
    textSecondary: '#5A6380',
    primary: '#2150FF',
    onPrimary: '#FFFFFF',
    accent: '#2150FF',
    success: '#16A34A',
    successText: '#15803D',
    error: '#DC2626',
    ring: '#2150FF',
  },
};

export const BRAND_BLUE = '#2150FF';
