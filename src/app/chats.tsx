import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { GroupAvatar } from '@/components/group-avatar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { User } from '@/data/types';
import { useApp } from '@/store/app-store';
import { useChat } from '@/store/chat-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { shortTime } from '@/utils/dates';
import { previewText } from '@/utils/chat';
import { listEnter, listLayout } from '@/utils/motion';

export default function Chats() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, userById } = useApp();
  const { chats, lastMessage, unread } = useChat();
  const nameOf = (id: string) => userById(id)?.name.split(' ')[0] ?? 'Someone';
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q
    ? chats.filter(
        (c) => c.name.toLowerCase().includes(q) || c.memberIds.some((id) => id !== me.id && userById(id)?.name.toLowerCase().includes(q)),
      )
    : chats;
  const totalUnread = chats.reduce((n, c) => n + (unread[c.id] ?? 0), 0);

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.head}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
        <PressableScale
          scaleTo={0.95}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel="New group"
          onPress={() => router.push('/chat/new')}
          style={[styles.newBtn, { backgroundColor: colors.primary }]}>
          <Icon name="plus" size={18} color={colors.onPrimary} strokeWidth={2.6} />
          <Text variant="caption" style={{ color: colors.onPrimary }}>
            New group
          </Text>
        </PressableScale>
      </View>
      <View style={styles.titleBlock}>
        <Text variant="title" accessibilityRole="header">
          Chats
        </Text>
        <Text variant="small" color="textSecondary">
          {totalUnread ? `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}` : 'You’re all caught up'}
        </Text>
      </View>
      {chats.length > 0 ? (
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats or people"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Search chats"
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? <IconButton icon="close" label="Clear search" onPress={() => setQuery('')} /> : null}
        </View>
      ) : null}
      <FlatList
        data={shown}
        keyboardShouldPersistTaps="handled"
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
                onPress={() =>
                  router.push({
                    pathname: '/chat/[id]',
                    params: { id: item.id },
                  })
                }
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surface : 'transparent' }]}>
                <GroupAvatar members={members} size={54} />
                <View style={styles.flex}>
                  <View style={styles.line}>
                    <Text variant="bodyMedium" numberOfLines={1} style={[styles.flex, count ? styles.bold : null]}>
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
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.border }]} />}
        ListEmptyComponent={
          q ? (
            <Text color="textSecondary" align="center" style={styles.noMatch}>
              No chats match “{query.trim()}”.
            </Text>
          ) : (
            <View style={styles.empty}>
              <Text variant="heading" align="center">
                No chats yet
              </Text>
              <Text color="textSecondary" align="center">
                Start a group to chat and split bills with friends.
              </Text>
              <Button label="New group" icon="plus" onPress={() => router.push('/chat/new')} style={styles.emptyButton} />
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 20,
    minHeight: 52,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TAP,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  titleBlock: { paddingHorizontal: 20, marginTop: 4, gap: 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingLeft: 14,
    paddingRight: 2,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    minHeight: MIN_TAP,
    fontFamily: Fonts.regular,
    fontSize: 16,
  },
  list: { paddingHorizontal: 12, paddingTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 84,
    paddingHorizontal: 8,
    borderRadius: 18,
  },
  bold: { fontFamily: Fonts.bold },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 76, marginRight: 8 },
  noMatch: { marginTop: 40 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { marginTop: 80, gap: 8, paddingHorizontal: 24 },
  emptyButton: { marginTop: 16 },
});
