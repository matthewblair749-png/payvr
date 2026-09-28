import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';

const DOCS: Record<string, { title: string; sections: [string, string][] }> = {
  help: {
    title: 'Help',
    sections: [
      ['How do I pay someone?', 'Tap the blue button, type an amount, then hold your phone near theirs while they also have Payvr open on the Tap screen. Check their name and photo, then confirm with Face ID or your PIN.'],
      ['Their phone doesn’t show up', 'Both phones need Bluetooth on and Payvr open on the Tap screen. You can also use “Show QR code instead”.'],
      ['Can I pay someone who isn’t nearby?', 'Yes — once you’ve tapped with someone, open their profile and use Send or Request.'],
      ['Is this real money?', 'No. This prototype only uses test money.'],
    ],
  },
  terms: {
    title: 'Terms',
    sections: [
      ['Prototype', 'Payvr is a prototype for testing. Balances and payments are test data and have no cash value.'],
      ['Your account', 'You’re responsible for keeping your phone, PIN and Face ID secure.'],
    ],
  },
  privacy: {
    title: 'Privacy',
    sections: [
      ['What we keep', 'Your name, @handle, phone number, photo, and your Payvr activity. You can only see your own data.'],
      ['Nearby', 'Your phone is only discoverable while you’re on the Tap screen, using a short-lived token that expires after 60 seconds.'],
      ['Cards', 'We never store card numbers. Payment methods are held by Stripe and referenced by token.'],
    ],
  },
};

export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const page = DOCS[doc] ?? DOCS.help;
  return (
    <Screen back="back" title={page.title} scroll>
      {page.sections.map(([h, b]) => (
        <View key={h} style={styles.section}>
          <Text variant="heading">{h}</Text>
          <Text color="textSecondary">{b}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: 6, marginTop: 20 } });
