import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Card, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TEST_FUNDING_SOURCES } from '@/services/payments';

export default function Bank() {
  return (
    <Screen back="back" title="Bank & card" footer={<Button label="Link another (test)" variant="secondary" icon="plus" disabled />}>
      <Card style={styles.card}>
        {TEST_FUNDING_SOURCES.map((s, i) => (
          <ListRow
            key={s.id}
            icon={s.kind === 'bank' ? 'bank' : 'lock'}
            label={s.label}
            value={s.kind === 'bank' ? 'Cash out' : 'Add money'}
            last={i === TEST_FUNDING_SOURCES.length - 1}
          />
        ))}
      </Card>
      <Text variant="small" color="textSecondary" style={styles.note}>
        These are Stripe test-mode accounts. Payvr never stores card numbers — only Stripe tokens.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12 },
  note: { marginTop: 10, marginLeft: 4 },
});
