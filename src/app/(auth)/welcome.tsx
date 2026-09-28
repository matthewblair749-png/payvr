import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';
import { signupDraft } from '@/store/signup-draft';

export default function Welcome() {
  const { completeSignUp } = useApp();
  const first = signupDraft.name.split(' ')[0] || 'there';

  return (
    <Screen
      footer={
        <Button
          label="Start using Payvr"
          onPress={async () => {
            await completeSignUp({
              name: signupDraft.name || 'Matthew Cooper',
              handle: signupDraft.handle || 'matthew',
              phone: signupDraft.phone,
              avatarUrl: signupDraft.avatarUrl,
            });
            router.replace('/home');
          }}
        />
      }>
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.springify().damping(14)}>
          <Avatar name={signupDraft.name || 'You'} uri={signupDraft.avatarUrl} size={112} ring />
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(150)} style={styles.text}>
          <Text variant="title" align="center">
            You’re in, {first}.
          </Text>
          <Text color="textSecondary" align="center">
            Your wallet is loaded with test money so you can try everything. No real money moves in this prototype.
          </Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  text: { gap: 10, maxWidth: 320 },
});
