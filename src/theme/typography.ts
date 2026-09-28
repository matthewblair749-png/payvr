import type { TextStyle } from 'react-native';

export const Fonts = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  bold: 'SpaceGrotesk_700Bold',
} as const;

export const Type = {
  hero: { fontFamily: Fonts.bold, fontSize: 64, lineHeight: 70, letterSpacing: -2.5 },
  display: { fontFamily: Fonts.bold, fontSize: 44, lineHeight: 50, letterSpacing: -1.5 },
  title: { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  heading: { fontFamily: Fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  body: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 22 },
  amount: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  small: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: Fonts.medium, fontSize: 17, lineHeight: 22 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;

export const Radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 } as const;
export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
/** Minimum tap target size (Apple HIG / WCAG 2.5.5). */
export const MIN_TAP = 44;
