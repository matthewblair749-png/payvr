import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import type { Palette } from '@/theme/colors';
import { Type, type TypeVariant } from '@/theme/typography';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: keyof Palette;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[Type[variant], { color: colors[color] }, align && { textAlign: align }, style]}
    />
  );
}
