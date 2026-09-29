import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useChat } from '@/store/chat-store';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';

import { Icon } from './icon';
import { Text } from './text';

/** Opens group chats; shows how many messages are unread. */
export function ChatButton() {
  const { colors } = useTheme();
  const { totalUnread } = useChat();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={totalUnread ? `Chats, ${totalUnread} unread` : 'Chats'}
      hitSlop={6}
      onPress={() => {
        haptics.tap();
        router.push('/chats');
      }}
      style={({ pressed }) => [styles.base, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name="comment" size={22} color={colors.text} />
      {totalUnread ? (
        <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          <Text variant="caption" style={[styles.count, { color: colors.onPrimary }]}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
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
