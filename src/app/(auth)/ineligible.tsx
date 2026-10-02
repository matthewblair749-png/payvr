import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { IconTile } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { MIN_AGE } from '@/config/compliance';

/** Shown when someone can't open an account: under the minimum age, or outside a supported country. */
export default function Ineligible() {
  const { reason } = useLocalSearchParams<{ reason?: 'age' | 'country' }>();
  const age = reason === 'age';
  return (
    <Screen footer={<Button label="Back to start" variant="secondary" onPress={() => router.replace('/onboarding')} />}>
      <View style={styles.body}>
        <IconTile icon={age ? 'user' : 'globe'} size={64} />
        <Text variant="title" align="center" accessibilityRole="header">
          {age ? `You need to be ${MIN_AGE} or older` : 'Payvr isn’t available in your country yet'}
        </Text>
        <Text color="textSecondary" align="center">
          {age
            ? `Our payments partner can only open accounts for people ${MIN_AGE} and older. We haven’t saved any of your details.`
            : 'Right now Payvr works for people who live in the United States. We haven’t saved any of your details.'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 8 },
});
