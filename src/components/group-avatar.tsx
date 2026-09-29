import { StyleSheet, View } from 'react-native';

import type { User } from '@/data/types';
import { useTheme } from '@/theme/theme-provider';

import { Avatar } from './avatar';

/** Two overlapping faces for a group (the first two members other than you). */
export function GroupAvatar({ members, size = 52 }: { members: User[]; size?: number }) {
  const { colors } = useTheme();
  const [a, b] = members;
  if (!a) return <View style={{ width: size, height: size }} />;
  if (!b) return <Avatar name={a.name} uri={a.avatarUrl} size={size} />;
  const small = Math.round(size * 0.64);
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Avatar name={a.name} uri={a.avatarUrl} size={small} />
      <View style={[styles.back, { borderColor: colors.background, borderRadius: small / 2 + 2 }]}>
        <Avatar name={b.name} uri={b.avatarUrl} size={small} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', right: -2, bottom: -2, borderWidth: 2 },
});
