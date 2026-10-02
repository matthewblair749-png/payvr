import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card, ListRow, SectionLabel } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Figure, Footnote, Meter, Section, SettingsHero } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { DAILY_LIMIT_CENTS } from '@/config/compliance';
import { MAX_ADD_MONEY_CENTS } from '@/services/payments';
import { useAccount } from '@/store/account';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { formatShort } from '@/utils/money';

export default function Limits() {
  const { colors } = useTheme();
  const { sentTodayCents } = useApp();
  const { kyc, dailyLimitCents } = useAccount();
  const verified = kyc === 'verified';
  const left = Math.max(0, dailyLimitCents - sentTodayCents);

  return (
    <Screen back="back" scroll>
      <SettingsHero icon="shield" title="Limits" body="Limits keep your money safe and grow once your identity is verified." />

      <Section index={1} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.tierRow}>
          <View style={[styles.tier, { backgroundColor: (verified ? colors.success : colors.accent) + '22' }]}>
            <Icon name={verified ? 'check' : 'user'} size={14} color={verified ? colors.success : colors.accent} strokeWidth={3} />
            <Text variant="caption" color={verified ? 'successText' : 'accent'}>
              {verified ? 'Verified' : 'New account'}
            </Text>
          </View>
        </View>
        <View
          accessible
          accessibilityLabel={`${formatShort(left)} left to send today out of ${formatShort(dailyLimitCents)}`}
          style={styles.limitHead}>
          <View>
            <Figure>{formatShort(left)}</Figure>
            <Text variant="small" color="textSecondary">
              left to send today
            </Text>
          </View>
          <Text variant="small" color="textSecondary">
            of {formatShort(dailyLimitCents)}
          </Text>
        </View>
        <Meter value={sentTodayCents} max={dailyLimitCents} />
      </Section>

      <Section index={2}>
        <SectionLabel>Sending, per 24 hours</SectionLabel>
        <Card>
          <ListRow label="New account" value={formatShort(DAILY_LIMIT_CENTS.new)} right={!verified ? <Current /> : undefined} />
          <ListRow label="Verified" value={formatShort(DAILY_LIMIT_CENTS.verified)} right={verified ? <Current /> : undefined} last />
        </Card>
        {!verified ? (
          <Footnote>Finish verifying your identity to raise your limit to {formatShort(DAILY_LIMIT_CENTS.verified)} a day.</Footnote>
        ) : null}
      </Section>

      <Section index={3}>
        <SectionLabel>Other limits</SectionLabel>
        <Card>
          <ListRow label="Add money, per transfer" value={formatShort(MAX_ADD_MONEY_CENTS)} />
          <ListRow label="Receiving" value="No limit" last />
        </Card>
        <Footnote>Limits are a rolling 24 hours. Need more? Contact support and we’ll review your account.</Footnote>
        <ListRowLink />
      </Section>
    </Screen>
  );
}

function Current() {
  return (
    <Text variant="caption" color="accent">
      Your limit
    </Text>
  );
}

function ListRowLink() {
  return (
    <Card style={styles.support}>
      <ListRow icon="help" label="Ask for a higher limit" onPress={() => router.push('/support/report')} last />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, padding: 16, gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  tierRow: { flexDirection: 'row' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13 },
  limitHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  support: { marginTop: 16 },
});
