import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Segmented } from '@/components/segmented';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { dayLabel } from '@/utils/dates';

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

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">
          Activity
        </Text>
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
  head: { paddingHorizontal: 24, gap: 16, paddingBottom: 4 },
  list: { paddingHorizontal: 24, paddingBottom: 32 },
  section: { letterSpacing: 0.8, marginTop: 20, marginBottom: 4 },
  empty: { marginTop: 64 },
});
