import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
import type { Transaction, User } from '@/data/types';
import { describe, useApp } from '@/store/app-store';
import { useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { dayLabel } from '@/utils/dates';
import { formatCents } from '@/utils/money';
import { listEnter, listLayout } from '@/utils/motion';

type Tab = 'friends' | 'me';
type Filter = 'all' | 'sent' | 'received' | 'requests' | 'pending';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'received', label: 'Received' },
  { value: 'requests', label: 'Requests' },
  { value: 'pending', label: 'Pending' },
];

/**
 * Activity: your own history with amounts, filters and search, and your month in and out.
 * Friends: payments between people you know (never their amounts), with their faces on top.
 */
export default function Activity() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transactions, me, userById } = useApp();
  const { friendsFeed } = useSocial();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'friends' ? 'friends' : 'me');
  // Opened again (e.g. Wallet → See all) while already mounted: switch tabs.
  const [seenTabParam, setSeenTabParam] = useState(params.tab);
  if (params.tab !== seenTabParam) {
    setSeenTabParam(params.tab);
    if (params.tab === 'me' || params.tab === 'friends') setTab(params.tab);
  }
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().replace(/^@/, '').toLowerCase();
  const mine = useMemo(
    () =>
      transactions.filter((t) => {
        const d = describe(t, me.id);
        // Money that left you / came to you (payments, and requests once paid).
        if (filter === 'sent' && !d.sent) return false;
        if (filter === 'received' && !d.received) return false;
        if (filter === 'requests' && !d.isRequest) return false;
        if (filter === 'pending' && t.status !== 'pending') return false;
        if (!q) return true;
        const other = userById(d.otherId);
        return (
          t.note.toLowerCase().includes(q) ||
          !!other?.name.toLowerCase().includes(q) ||
          !!other?.handle.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
        );
      }),
    [transactions, filter, q, me.id, userById],
  );
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


  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text variant="title" accessibilityRole="header">
            Activity
          </Text>
          <ChatButton />
        </View>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'me', label: 'You' },
            { value: 'friends', label: 'Friends' },
          ]}
        />
      </View>
      {tab === 'me' ? (
        <MyActivity
          list={mine}
          total={transactions.length}
          filter={filter}
          setFilter={setFilter}
          query={query}
          setQuery={setQuery}
          month={month}
        />
      ) : (
      <FlatList
        data={friendsFeed}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />}
        ListHeaderComponent={
          <View style={styles.top}>
            {active.length ? (
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
          friendsFeed.length ? (
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
          const newDay = index === 0 || dayLabel(friendsFeed[index - 1].createdAt) !== day;
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
            When your friends pay each other, it shows up here.
          </Text>
        }
      />
      )}
    </View>
  );
}

type Month = { label: string; inCents: number; outCents: number };

/** Your own payments and requests, newest first, with filters and search. */
function MyActivity({
  list,
  total,
  filter,
  setFilter,
  query,
  setQuery,
  month,
}: {
  list: Transaction[];
  total: number;
  filter: Filter;
  setFilter: (f: Filter) => void;
  query: string;
  setQuery: (q: string) => void;
  month: Month;
}) {
  const { colors } = useTheme();
  return (
    <FlatList
      data={list}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.top}>
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
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="search" size={18} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, @handle, note or ID"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Search activity"
              returnKeyType="search"
              autoCapitalize="none"
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
            {FILTERS.map((f) => {
              const on = f.value === filter;
              return (
                <PressableScale
                  key={f.value}
                  scaleTo={0.95}
                  haptic="tap"
                  accessibilityRole="tab"
                  accessibilityLabel={`Show ${f.label.toLowerCase()}`}
                  aria-selected={on}
                  onPress={() => setFilter(f.value)}
                  style={[
                    styles.chip,
                    on ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border },
                  ]}>
                  <Text variant="caption" style={{ color: on ? colors.onPrimary : colors.text }}>
                    {f.label}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>
      }
      renderItem={({ item, index }) => {
        const day = dayLabel(item.createdAt);
        const newDay = index === 0 || dayLabel(list[index - 1].createdAt) !== day;
        return (
          <Animated.View entering={listEnter(index)} layout={listLayout}>
            {newDay ? (
              <Text variant="caption" color="textSecondary" style={[styles.label, styles.day]} accessibilityRole="header">
                {day.toUpperCase()}
              </Text>
            ) : null}
            <TransactionRow tx={item} />
          </Animated.View>
        );
      }}
      ListEmptyComponent={
        <Text color="textSecondary" align="center" style={styles.empty}>
          {total === 0
            ? 'Your payments and requests show up here.'
            : query
              ? `Nothing matches “${query.trim()}”.`
              : `No ${filter === 'all' ? '' : FILTERS.find((f) => f.value === filter)!.label.toLowerCase() + ' '}activity yet.`}
        </Text>
      }
    />
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, minHeight: MIN_TAP, fontFamily: Fonts.regular, fontSize: 16, outlineWidth: 0 },
  chips: { gap: 8, paddingRight: 20 },
  chip: { minHeight: MIN_TAP, minWidth: MIN_TAP, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: 64, paddingHorizontal: 24 },
});
