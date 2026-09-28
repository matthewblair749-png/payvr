import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';

import { Text } from './text';

type Props = { name: string; uri?: string | null; size?: number; ring?: boolean };

/** Photo avatar with an initials fallback (the prototype's mock people have no photos). */
export function Avatar({ name, uri, size = 44, ring }: Props) {
  const { colors } = useTheme();
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      accessibilityLabel={`${name}'s photo`}
      accessibilityRole="image"
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface,
          borderColor: ring ? colors.primary : colors.border,
          borderWidth: ring ? 3 : StyleSheet.hairlineWidth,
        },
      ]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text
          style={{
            fontFamily: Fonts.bold,
            fontSize: size * 0.36,
            lineHeight: size * 0.44,
            letterSpacing: -0.5,
            color: colors.text,
          }}>
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
