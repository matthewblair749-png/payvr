import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { LogoMark } from '@/components/logo';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';
import { Fonts } from '@/theme/typography';

/** Splash: logo + wordmark, then route by session. */
export default function Splash() {
  const { status } = useApp();

  useEffect(() => {
    if (status === 'loading') return;
    const t = setTimeout(() => {
      router.replace(status === 'signedIn' ? '/home' : '/onboarding');
    }, 1300);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeIn.duration(400)}>
        <LogoMark size={104} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Text style={styles.wordmark}>payvr</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  wordmark: { fontFamily: Fonts.bold, fontSize: 40, lineHeight: 46, letterSpacing: -1.6 },
});
