import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ChatButton } from '@/components/chat-button';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Segmented } from '@/components/segmented';
import { StoryCard } from '@/components/story-card';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import type { User } from '@/data/types';
import { describe, useApp } from '@/store/app-store';
import { useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { dayLabel } from '@/utils/dates';
import { formatCents } from '@/utils/money';
import { listEnter, listLayout } from '@/utils/motion';

type Tab = 'friends' | 'me';

/**
 * Friends: payments between people you know (never their amounts), with their faces on top.
 * Just me: your own history with amounts, your month, and your requests.
 */
export default function Feed() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transactions, me, userById } = useApp();
  const { friendsFeed, myFeed } = useSocial();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'me' ? 'me' : 'friends');
  // Opened again (e.g. Wallet → See all) while already mounted: switch to Just me.
  const [seenTabParam, setSeenTabParam] = useState(params.tab);
  if (params.tab !== seenTabParam) {
    setSeenTabParam(params.tab);
    if (params.tab === 'me') setTab('me');
  }

  // Friends: what's still open. Just me: also declined requests, so nothing disappears.
  // Requests live on Just me (and Home); the Friends tab stays about friends.
  const open = tab === 'me' ? transactions.filter((t) => t.status === 'pending' || t.status === 'declined') : [];
  // Friends with recent activity, as a row of faces.
  const active = useMemo(() => {
    const seen = new Set<string>();
    const list: User[] = [];
    for (const st of friendsFeed) {
      for (const id of [st.fromUser, st.toUser]) {
        const u = id === me.id ? undefined : userById(id);
        if (u && !seen.has(id)) {
          seen.add(id);
          list.push(u);
        }
      }
    }
    return list.slice(0, 10);
  }, [friendsFeed, me.id, userById]);
  const month = useMemo(() => {
    const now = new Date();
    let inCents = 0;
    let outCents = 0;
    for (const t of transactions) {
      const d = describe(t, me.id);
      const at = new Date(t.completedAt ?? t.createdAt);
      if (at.getMonth() !== now.getMonth() || at.getFullYear() !== now.getFullYear()) continue;
      if (d.received) inCents += t.amountCents;
      if (d.sent) outCents += t.amountCents;
    }
    return { label: now.toLocaleDateString('en-US', { month: 'long' }), inCents, outCents };
  }, [transactions, me.id]);

  const data = tab === 'friends' ? friendsFeed : myFeed;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text variant="title" accessibilityRole="header">
            Feed
          </Text>
          <ChatButton />
        </View>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'friends', label: 'Friends' },
            { value: 'me', label: 'Just me' },
          ]}
        />
      </View>
      <FlatList
        data={data}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />}
        ListHeaderComponent={
          <View style={styles.top}>
            {tab === 'me' ? (
              <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.stat}>
                  <Text variant="caption" color="textSecondary">
                    In · {month.label}
                  </Text>
                  <Text variant="heading" color="successText" style={styles.num}>
                    +{formatCents(month.inCents)}
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text variant="caption" color="textSecondary">
                    Out · {month.label}
                  </Text>
                  <Text variant="heading" style={styles.num}>
                    −{formatCents(month.outCents)}
                  </Text>
                </View>
              </View>
            ) : null}
            {open.length ? (
              <View>
                <Text variant="caption" color="textSecondary" style={styles.label} accessibilityRole="header">
                  REQUESTS
                </Text>
                {open.map((t) => (
                  <TransactionRow key={t.id} tx={t} />
                ))}
              </View>
            ) : null}
            {tab === 'friends' && active.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faces}>
                {active.map((u, i) => (
                  <Animated.View key={u.id} entering={listEnter(i)}>
                    <PressableScale
                      scaleTo={0.92}
                      haptic="tap"
                      accessibilityRole="button"
                      accessibilityLabel={`${u.name}'s profile`}
                      onPress={() => router.push({ pathname: '/person/[id]', params: { id: u.id } })}
                      style={styles.face}>
                      <View style={[styles.faceRing, { borderColor: colors.accent }]}>
                        <Avatar name={u.name} uri={u.avatarUrl} size={54} />
                      </View>
                      <Text variant="caption" numberOfLines={1}>
                        {u.name.split(' ')[0]}
                      </Text>
                    </PressableScale>
                  </Animated.View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        ListFooterComponent={
          tab === 'friends' && data.length ? (
            <View style={styles.footer}>
              <Icon name="lock" size={13} color={colors.textSecondary} />
              <Text variant="caption" color="textSecondary">
                Friends see who paid whom and the note, never the amount.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          // "Today", "Yesterday", "Mon, Sep 22" above the first post of each day.
          const day = dayLabel(item.createdAt);
          const newDay = index === 0 || dayLabel(data[index - 1].createdAt) !== day;
          return (
            <Animated.View entering={listEnter(index)} layout={listLayout}>
              {newDay ? (
                <Text variant="caption" color="textSecondary" style={[styles.label, styles.day]} accessibilityRole="header">
                  {day.toUpperCase()}
                </Text>
              ) : null}
              <StoryCard story={item} />
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <Text color="textSecondary" align="center" style={styles.empty}>
            {tab === 'friends' ? 'When your friends pay each other, it shows up here.' : 'Your payments show up here.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { paddingHorizontal: 20, gap: 14, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: -10 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  top: { gap: 14, paddingTop: 6, paddingBottom: 4 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  label: { letterSpacing: 0.8 },
  day: { marginTop: 14, marginBottom: 2 },
  faces: { gap: 14, paddingVertical: 4, paddingRight: 20 },
  face: { alignItems: 'center', gap: 6, width: 64 },
  faceRing: { borderWidth: 2, borderRadius: 32, padding: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  summary: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  stat: { flex: 1, paddingHorizontal: 16, gap: 2 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  num: { fontVariant: ['tabular-nums'] },
  empty: { marginTop: 64, paddingHorizontal: 24 },
});
