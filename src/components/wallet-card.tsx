import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { BRAND_BLUE } from '@/theme/colors';
import { Fonts } from '@/theme/typography';
import { formatCents } from '@/utils/money';
import { smooth } from '@/utils/motion';

import { Icon } from './icon';
import { LogoGlyph } from './logo';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

const WHITE = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.72)';

/**
 * The Payvr card as the wallet's hero: balance on the front; tap to flip to the back.
 * Flat brand blue with the Payvr rings as texture (no gradient). No card number exists or is stored.
 */
export function WalletCard({ name, balanceCents, hidden }: { name: string; balanceCents: number; hidden: boolean }) {
  const reduceMotion = useReducedMotion();
  const [back, setBack] = useState(false);
  const flip = useSharedValue(0);

  const toggle = () => {
    const next = !back;
    setBack(next);
    flip.set(reduceMotion ? (next ? 1 : 0) : withTiming(next ? 1 : 0, smooth(520)));
  };

  const front = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
  }));
  const rear = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [-180, 0])}deg` }],
  }));

  return (
    <PressableScale
      scaleTo={0.98}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={
        back
          ? 'Payvr card, back. Test card, not issued. Double-tap to flip back.'
          : `Payvr card. Balance ${hidden ? 'hidden' : formatCents(balanceCents)}. Double-tap to flip.`
      }
      onPress={toggle}
      style={styles.wrap}>
      {/* Front */}
      <Animated.View style={[styles.face, front]}>
        <Rings />
        <View style={styles.row}>
          <View style={styles.brand}>
            <LogoGlyph size={26} color={WHITE} />
            <Text style={styles.wordmark}>payvr</Text>
          </View>
          <Text variant="caption" style={{ color: SOFT }}>
            DEBIT · TEST
          </Text>
        </View>
        <View>
          <Text variant="caption" style={{ color: SOFT }}>
            Balance
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.balance}>
            {hidden ? '$••••••' : formatCents(balanceCents)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Text style={styles.digits}>•••• 0000</Text>
        </View>
      </Animated.View>

      {/* Back */}
      <Animated.View style={[styles.face, styles.backFace, rear]}>
        <View style={styles.stripe} />
        <View style={styles.backBody}>
          <View style={styles.backLine}>
            <Icon name="lock" size={16} color={WHITE} />
            <Text variant="bodyMedium" style={{ color: WHITE }}>
              Test card · not issued
            </Text>
          </View>
          <Text variant="small" style={{ color: SOFT }}>
            Payvr never stores card numbers on your phone. Real cards come after test mode.
          </Text>
        </View>
        <Text variant="caption" style={[styles.tapBack, { color: SOFT }]}>
          Tap to flip back
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

/** The brand's rings, drawn faintly in the top-right corner. */
function Rings() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 214" preserveAspectRatio="xMaxYMin slice" pointerEvents="none">
      {[150, 112, 74].map((r, i) => (
        <Circle key={r} cx="330" cy="-10" r={r} fill="none" stroke={WHITE} strokeOpacity={0.08 + i * 0.04} strokeWidth="14" />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BRAND_BLUE,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  backFace: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: { color: WHITE, fontFamily: Fonts.bold, fontSize: 20, lineHeight: 24, letterSpacing: -0.8 },
  balance: { color: WHITE, fontFamily: Fonts.bold, fontSize: 40, lineHeight: 46, letterSpacing: -1.6, fontVariant: ['tabular-nums'] },
  name: { color: WHITE, flexShrink: 1 },
  digits: { color: WHITE, fontFamily: Fonts.medium, fontSize: 15, letterSpacing: 2 },
  stripe: { height: 44, marginTop: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
  backBody: { paddingHorizontal: 20, gap: 6 },
  backLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tapBack: { paddingHorizontal: 20, paddingBottom: 16 },
});
