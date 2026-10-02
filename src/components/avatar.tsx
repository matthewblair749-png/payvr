import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { tintFor } from '@/theme/avatar-tints';
import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';

import { Icon, type IconName } from './icon';
import { PayvrLogo } from './payvr-logo';
import { Text } from './text';

/** `icon: 'payvr'` is the tapped-in-person mark: the p logo on brand blue. */
export type AvatarBadge = { icon: IconName | 'payvr'; color: string; label: string };

type Props = {
  name: string;
  uri?: string | null;
  size?: number;
  ring?: boolean;
  /** Small corner badge, e.g. the direction of a payment. */
  badge?: AvatarBadge;
};

/** Photo avatar, or initials on a person-specific tint. */
export function Avatar({ name, uri, size = 44, ring, badge }: Props) {
  const { colors, scheme } = useTheme();
  const tint = tintFor(name, scheme);
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const badgeSize = Math.round(size * 0.42);
  return (
    <View accessibilityLabel={`${name}'s photo`} accessibilityRole="image" style={{ width: size, height: size }}>
      <View
        style={[
          styles.base,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: tint.bg,
            borderColor: ring ? colors.primary : 'transparent',
            borderWidth: ring ? 3 : 0,
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
              color: tint.fg,
            }}>
            {initials}
          </Text>
        )}
      </View>
      {badge ? (
        <View
          accessibilityLabel={badge.label}
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: badge.icon === 'payvr' ? colors.primary : colors.surface,
              borderColor: colors.background,
            },
          ]}>
          {badge.icon === 'payvr' ? (
            <PayvrLogo size={badgeSize * 0.8} color={colors.onPrimary} cutColor={colors.primary} />
          ) : (
            <Icon name={badge.icon} size={badgeSize * 0.62} color={badge.color} strokeWidth={2.6} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
