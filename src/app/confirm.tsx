import { StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Screen } from '@/components/screen';
import { SendPanel } from '@/components/send-panel';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';

/** Remote payments (picked from People, a profile, or a QR code) end here. */
export default function Confirm() {
  const { draft, userById } = useApp();
  const peer = draft?.peerId ? userById(draft.peerId) : undefined;
  if (!draft || !peer) return <Screen back="back">{null}</Screen>;
  const first = peer.name.split(' ')[0];

  return (
    <Screen back="back" scroll>
      <Animated.View entering={FadeInUp.duration(300)} style={styles.center}>
        {draft.origin === 'qrRequest' ? (
          <Text variant="caption" color="accent" align="center" style={styles.badge}>
            {first.toUpperCase()} IS REQUESTING
          </Text>
        ) : null}
        <SendPanel peer={peer} draft={draft} />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingVertical: 8 },
  badge: { letterSpacing: 0.8, marginBottom: 8 },
});
