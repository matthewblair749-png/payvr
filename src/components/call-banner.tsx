import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { useApp } from '@/store/app-store';
import { useCall } from '@/store/call-store';
import { BRAND_BLUE } from '@/theme/colors';
import { Fonts } from '@/theme/typography';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

/**
 * While a call is live and you've stepped away (say, to pay them): a small bubble with their
 * face and the call time, floating on the right edge where it doesn't cover screen controls.
 * Tap it to go back to the call.
 */
export function CallBanner() {
  const { call, expanded, setExpanded } = useCall();
  const { userById } = useApp();
  const [now, setNow] = useState(() => Date.now());
  const active = !!call && call.phase !== 'ended' && !expanded;

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [active]);

  if (!active || !call) return null;
  const peer = userById(call.peerId);
  const first = peer?.name.split(' ')[0] ?? 'Call';
  const secs = call.connectedAt ? Math.max(0, Math.floor((now - call.connectedAt) / 1000)) : 0;
  const time = call.connectedAt ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '…';

  return (
    <Animated.View entering={ZoomIn} exiting={ZoomOut} style={styles.wrap}>
      <PressableScale
        scaleTo={0.92}
        accessibilityRole="button"
        accessibilityLabel={`Return to call with ${first}, ${call.connectedAt ? time : 'calling'}`}
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [styles.bubble]}>
        <View style={[styles.ring, { borderColor: BRAND_BLUE }]}>
          <Avatar name={peer?.name ?? '?'} uri={peer?.avatarUrl} size={52} />
          <View style={[styles.kind, { backgroundColor: BRAND_BLUE }]}>
            <Icon name={call.kind === 'video' ? 'video' : 'call'} size={11} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </View>
        <View style={[styles.time, { backgroundColor: BRAND_BLUE }]}>
          <Text style={styles.timeText}>{time}</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 10, top: '45%', zIndex: 50 },
  bubble: { alignItems: 'center' },
  ring: { borderWidth: 3, borderRadius: 32, padding: 2 },
  kind: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { marginTop: -8, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999 },
  timeText: { color: '#FFFFFF', fontFamily: Fonts.medium, fontSize: 11, lineHeight: 15, fontVariant: ['tabular-nums'] },
});
