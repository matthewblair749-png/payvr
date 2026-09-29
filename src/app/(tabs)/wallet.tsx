import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Card, ListRow, SectionLabel } from '@/components/list-row';
import { LogoGlyph } from '@/components/logo';
import { Text } from '@/components/text';
import { useCountUp } from '@/hooks/use-count-up';
import { DAILY_SEND_LIMIT_CENTS, STRIPE_MODE, TEST_FUNDING_SOURCES } from '@/services/payments';
import { useApp } from '@/store/app-store';
import { BRAND_BLUE } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';
import { formatCents, formatShort } from '@/utils/money';

export default function Wallet() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, balanceCents, sentTodayCents } = useApp();
  const shown = useCountUp(balanceCents);
  const bank = STRIPE_MODE ? 'Stripe test account' : TEST_FUNDING_SOURCES[1].label;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}>
      <Text variant="caption" color="textSecondary" style={styles.kicker}>
        PAYVR BALANCE
      </Text>
      <Text
        accessibilityLabel={`Balance ${formatCents(balanceCents)}`}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.balance, { color: colors.text }]}>
        {formatCents(shown)}
      </Text>
      <View style={styles.trust}>
        <Icon name="shield" size={14} color={colors.textSecondary} />
        <Text variant="caption" color="textSecondary">
          Test money · protected by Face ID
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Add money"
          icon="plus"
          onPress={() => router.push({ pathname: '/money/[action]', params: { action: 'add' } })}
          style={styles.flex}
        />
        <Button
          label="Cash out"
          icon="arrowDown"
          variant="secondary"
          onPress={() => router.push({ pathname: '/money/[action]', params: { action: 'cashout' } })}
          style={styles.flex}
        />
      </View>

      <SectionLabel>Payvr card</SectionLabel>
      <DebitCard name={me.name} />
      <Text variant="small" color="textSecondary" style={styles.note}>
        A preview of the Payvr debit card. Cards aren’t issued in this test version.
      </Text>

      <SectionLabel>Linked bank</SectionLabel>
      <Card>
        <ListRow icon="bank" label={bank} value="Test" onPress={() => router.push('/settings/bank')} last />
      </Card>

      <SectionLabel>Limits</SectionLabel>
      <Card>
        <ListRow label="Sent in the last 24 hours" value={`${formatShort(sentTodayCents)} of ${formatShort(DAILY_SEND_LIMIT_CENTS)}`} last />
      </Card>
    </ScrollView>
  );
}

/** Flat brand-blue card with the "p" mark. Not a real card: no number is ever stored or shown. */
function DebitCard({ name }: { name: string }) {
  return (
    <View
      style={[styles.card, { backgroundColor: BRAND_BLUE }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Payvr debit card preview for ${name}`}>
      <View style={styles.cardTop}>
        <LogoGlyph size={40} color="#FFFFFF" />
        <Text variant="caption" style={styles.cardWhite}>
          DEBIT · PREVIEW
        </Text>
      </View>
      <View style={styles.chip} />
      <View style={styles.cardBottom}>
        <Text variant="bodyMedium" style={styles.cardWhite} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.cardWhite, styles.cardDigits]}>•••• 0000</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  flex: { flex: 1 },
  kicker: { letterSpacing: 1 },
  balance: { fontFamily: Fonts.bold, fontSize: 72, lineHeight: 80, letterSpacing: -3, fontVariant: ['tabular-nums'] },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  note: { marginTop: 10 },
  card: {
    aspectRatio: 1.586,
    borderRadius: 24,
    padding: 22,
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardWhite: { color: '#FFFFFF' },
  chip: { width: 44, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.28)' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  cardDigits: { fontFamily: Fonts.medium, fontSize: 16, letterSpacing: 2 },
});
