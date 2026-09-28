import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { dayLabel } from '@/utils/dates';
import { formatCents } from '@/utils/money';

type Filter = 'all' | 'sent' | 'received' | 'requests';

export default function Activity() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transactions, me } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const sections = useMemo(() => {
    const list = transactions.filter((t) => {
      const d = describe(t, me.id);
      if (filter === 'sent') return d.sent;
      if (filter === 'received') return d.received;
      if (filter === 'requests') return d.isRequest;
      return true;
    });
    const groups = new Map<string, typeof list>();
    for (const t of list) {
      const k = dayLabel(t.createdAt);
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [transactions, me.id, filter]);

  // This month at a glance: money in and money out.
  const month = useMemo(() => {
    const now = new Date();
    const inMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    let inCents = 0;
    let outCents = 0;
    for (const t of transactions) {
      const d = describe(t, me.id);
      if (!inMonth(t.completedAt ?? t.createdAt)) continue;
      if (d.received) inCents += t.amountCents;
      if (d.sent) outCents += t.amountCents;
    }
    return { label: now.toLocaleDateString('en-US', { month: 'long' }), inCents, outCents };
  }, [transactions, me.id]);

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">
          Activity
        </Text>
        <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.stat}>
            <Text variant="caption" color="textSecondary">
              In · {month.label}
            </Text>
            <Text variant="heading" color="successText" style={styles.num}>
              +{formatCents(month.inCents)}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text variant="caption" color="textSecondary">
              Out · {month.label}
            </Text>
            <Text variant="heading" style={styles.num}>
              −{formatCents(month.outCents)}
            </Text>
          </View>
        </View>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'sent', label: 'Sent' },
            { value: 'received', label: 'Received' },
            { value: 'requests', label: 'Requests' },
          ]}
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => (
          <Text variant="caption" color="textSecondary" style={styles.section} accessibilityRole="header">
            {section.title.toUpperCase()}
          </Text>
        )}
        renderItem={({ item }) => <TransactionRow tx={item} />}
        ListEmptyComponent={
          <Text color="textSecondary" align="center" style={styles.empty}>
            Nothing here yet.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { paddingHorizontal: 20, gap: 14, paddingBottom: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  stat: { flex: 1, paddingHorizontal: 16, gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  num: { fontVariant: ['tabular-nums'] },
  section: { letterSpacing: 0.8, marginTop: 20, marginBottom: 4 },
  empty: { marginTop: 64 },
});
