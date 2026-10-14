import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useChat } from '@/store/chat-store';
import { BRAND_BLUE } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/**
 * Opens group chats; shows how many messages are unread.
 * `onBrand`: white glyph in a see-through white circle, for the blue Home screen.
 */
export function ChatButton({ onBrand }: { onBrand?: boolean }) {
  const { colors } = useTheme();
  const { totalUnread } = useChat();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={totalUnread ? `Chats, ${totalUnread} unread` : 'Chats'}
      hitSlop={6}
      onPress={() => {
        haptics.tap();
        router.push('/chats');
      }}
      style={({ pressed }) => [styles.base, onBrand && styles.onBrand, { opacity: pressed ? 0.75 : 1 }]}>
      <Icon name="comment" size={22} color={onBrand ? '#FFFFFF' : colors.text} />
      {totalUnread ? (
        <View
          style={[
            styles.badge,
            onBrand
              ? { backgroundColor: '#0A0A0A', borderColor: BRAND_BLUE }
              : { backgroundColor: colors.primary, borderColor: colors.background },
          ]}>
          <Text variant="caption" style={[styles.count, { color: onBrand ? '#FFFFFF' : colors.onPrimary }]}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  onBrand: { borderRadius: MIN_TAP / 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 10, lineHeight: 12 },
});
