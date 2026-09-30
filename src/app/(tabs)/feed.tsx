import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatButton } from '@/components/chat-button';
import { Segmented } from '@/components/segmented';
import { StoryCard } from '@/components/story-card';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { describe, useApp } from '@/store/app-store';
import { useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { formatCents } from '@/utils/money';
import { listEnter, listLayout } from '@/utils/motion';

type Tab = 'friends' | 'me';

/**
 * Friends: payments between people you know (never their amounts). Just me: your own
 * history, with amounts. Requests waiting on you always sit on top.
 */
export default function Feed() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transactions, me } = useApp();
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
  const open = transactions.filter((t) => t.status === 'pending' || (tab === 'me' && t.status === 'declined'));
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
        ItemSeparatorComponent={() => <View style={styles.gap} />}
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
            {tab === 'friends' ? (
              <Text variant="caption" color="textSecondary" style={styles.privacyNote}>
                Friends see who paid whom and the note. Amounts stay private.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={listEnter(index)} layout={listLayout}>
            <StoryCard story={item} />
          </Animated.View>
        )}
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
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  top: { gap: 14, paddingTop: 6, paddingBottom: 14 },
  gap: { height: 12 },
  label: { letterSpacing: 0.8, paddingHorizontal: 4 },
  privacyNote: { paddingHorizontal: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  stat: { flex: 1, paddingHorizontal: 16, gap: 2 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  num: { fontVariant: ['tabular-nums'] },
  empty: { marginTop: 64, paddingHorizontal: 24 },
});
