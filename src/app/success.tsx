import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { CheckDraw } from '@/components/check-draw';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { describe, useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { formatShort } from '@/utils/money';

export default function Success() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { transactions, userById, me, setDraft } = useApp();
  const tx = transactions.find((t) => t.id === id);

  useEffect(() => () => setDraft(null), [setDraft]);

  if (!tx) return <Screen>{null}</Screen>;
  const d = describe(tx, me.id);
  const other = userById(d.otherId);
  const first = other?.name.split(' ')[0] ?? 'them';
  const amount = formatShort(tx.amountCents);
  const headline =
    tx.type === 'request' && tx.status === 'pending'
      ? `${amount} requested from ${first}`
      : tx.type === 'request'
        ? `${amount} paid to ${first}`
        : `${amount} sent to ${first}`;

  const done = () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/home');
  };

  return (
    <Screen footer={<Button label="Done" onPress={done} />}>
      <View style={styles.center}>
        <CheckDraw color={colors.success} />
        <Animated.View entering={FadeInUp.delay(450).duration(350)} style={styles.text}>
          <Text variant="display" align="center" accessibilityLiveRegion="polite">
            {headline}
          </Text>
          {tx.note ? (
            <Text variant="bodyMedium" color="textSecondary" align="center">
              {tx.note}
            </Text>
          ) : null}
          {tx.type === 'request' && tx.status === 'pending' ? (
            <Text color="textSecondary" align="center">
              We’ll let you know when {first} pays.
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  text: { gap: 10 },
});
