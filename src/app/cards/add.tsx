import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { LinkedCardFace } from '@/components/linked-card-face';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { cardLabel, TEST_CARDS } from '@/data/cards';
import { useAuthorize } from '@/store/authorize';
import { useCards } from '@/store/cards-store';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { EASE } from '@/utils/motion';

/**
 * Connect a card. Test mode offers Stripe's public test cards (they can't move real money);
 * only the brand, last 4 and expiry are kept. No card number is ever typed or stored here.
 */
export default function AddCard() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { cards, addCard } = useCards();
  const authorize = useAuthorize();
  const [busy, setBusy] = useState(false);
  const available = TEST_CARDS.filter((t) => !cards.some((c) => c.brand === t.brand && c.last4 === t.last4));

  const add = async (i: number) => {
    const card = available[i];
    if (busy || !card) return;
    setBusy(true);
    if (!(await authorize(`Add ${cardLabel(card)} to Payvr`))) {
      setBusy(false);
      return;
    }
    addCard(card);
    haptics.success();
    router.back();
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.head}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <Text variant="heading" accessibilityRole="header">
          Add a card
        </Text>
        <View style={{ width: MIN_TAP }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="shield" size={20} color={colors.accent} />
          <Text variant="small" color="textSecondary" style={styles.flex}>
            Test mode: pick one of Stripe’s test cards. They can’t move real money. Payvr keeps only the last 4 digits and
            expiry, never the full number or security code.
          </Text>
        </View>

        {available.map((c, i) => (
          <Animated.View key={c.last4} entering={FadeInDown.delay(60 + i * 70).duration(380).easing(EASE)}>
            <PressableScale
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel={`Add ${cardLabel(c)}, expires ${c.expMonth}/${c.expYear}`}
              aria-disabled={busy}
              onPress={() => add(i)}
              style={styles.cardWrap}>
              <LinkedCardFace card={{ ...c, id: 'preview', addedAt: '' }} />
              <View style={[styles.addChip, { backgroundColor: colors.primary }]}>
                <Icon name="plus" size={16} color={colors.onPrimary} strokeWidth={2.6} />
                <Text variant="caption" style={{ color: colors.onPrimary }}>
                  Add
                </Text>
              </View>
            </PressableScale>
          </Animated.View>
        ))}

        {!available.length ? (
          <Text color="textSecondary" align="center" style={styles.done}>
            All the test cards are already in your wallet.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, minHeight: 52 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  notice: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  cardWrap: { aspectRatio: 1.586 },
  addChip: {
    position: 'absolute',
    right: 14,
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: MIN_TAP - 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  done: { marginTop: 40 },
});
