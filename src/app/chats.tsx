import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { GroupAvatar } from '@/components/group-avatar';
import { IconButton } from '@/components/icon-button';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { User } from '@/data/types';
import { useApp } from '@/store/app-store';
import { useChat } from '@/store/chat-store';
import { useTheme } from '@/theme/theme-provider';
import { shortTime } from '@/utils/dates';
import { previewText } from '@/utils/chat';
import { listEnter, listLayout } from '@/utils/motion';

export default function Chats() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, userById } = useApp();
  const { chats, lastMessage, unread } = useChat();
  const nameOf = (id: string) => userById(id)?.name.split(' ')[0] ?? 'Someone';

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.head}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
        <Text variant="heading" accessibilityRole="header">
          Chats
        </Text>
        <IconButton icon="plus" label="New group" onPress={() => router.push('/chat/new')} />
      </View>
      <FlatList
        data={chats}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        renderItem={({ item, index }) => {
          const members = item.memberIds
            .filter((id) => id !== me.id)
            .map((id) => userById(id))
            .filter((u): u is User => !!u);
          const last = lastMessage(item.id);
          const count = unread[item.id] ?? 0;
          return (
            <Animated.View entering={listEnter(index)} layout={listLayout}>
              <PressableScale
                scaleTo={0.985}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${members.length + 1} people${count ? `, ${count} unread` : ''}. ${previewText(last, me.id, nameOf)}`}
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surface : 'transparent' }]}>
                <GroupAvatar members={members} />
                <View style={styles.flex}>
                  <View style={styles.line}>
                    <Text variant="bodyMedium" numberOfLines={1} style={styles.flex}>
                      {item.name}
                    </Text>
                    <Text variant="caption" color={count ? 'accent' : 'textSecondary'}>
                      {shortTime(last?.createdAt ?? item.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.line}>
                    <Text variant="small" color={count ? 'text' : 'textSecondary'} numberOfLines={1} style={styles.flex}>
                      {previewText(last, me.id, nameOf)}
                    </Text>
                    {count ? (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text variant="caption" style={{ color: colors.onPrimary }}>
                          {count}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </PressableScale>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="heading" align="center">
              No chats yet
            </Text>
            <Text color="textSecondary" align="center">
              Start a group to chat and split bills with friends.
            </Text>
            <Button label="New group" icon="plus" onPress={() => router.push('/chat/new')} style={styles.emptyButton} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, minHeight: 52 },
  list: { paddingHorizontal: 12, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, paddingHorizontal: 8, borderRadius: 18 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: 80, gap: 8, paddingHorizontal: 24 },
  emptyButton: { marginTop: 16 },
});
