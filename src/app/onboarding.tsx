import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/button';
import { LogoMark } from '@/components/logo';
import { FoundScene } from '@/components/onboarding/found-scene';
import { TapScene } from '@/components/onboarding/tap-scene';
import { TrustScene } from '@/components/onboarding/trust-scene';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';

const SLIDES = [
  {
    title: 'Tap phones.\nMoney’s sent.',
    body: 'Hold your phone near a friend’s. Their name pops up, you confirm, and it lands instantly.',
  },
  {
    title: 'See exactly who\nyou’re paying.',
    body: 'Their face and name appear before a cent moves. No usernames to mistype.',
  },
  {
    title: 'Safe by design.',
    body: 'Tap only works with phones right beside yours, and only while you’re on the Tap screen.',
  },
];

/** How long each slide shows before moving on by itself (stops once you touch it). */
const AUTO_MS = 5600;

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState(0);
  const [touched, setTouched] = useState(false);
  const [height, setHeight] = useState(0);
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      x.value = e.contentOffset.x;
    },
  });
  useAnimatedReaction(
    () => Math.round(x.value / Math.max(1, width)),
    (p, prev) => {
      if (p !== prev) scheduleOnRN(setPage, p);
    },
    [width],
  );

  const goTo = (i: number) => scroller.current?.scrollTo({ x: i * width, animated: true });

  // Plays through the story on its own until you swipe or tap a dot.
  useEffect(() => {
    if (touched || reduceMotion || page >= SLIDES.length - 1) return;
    const t = setTimeout(() => scroller.current?.scrollTo({ x: (page + 1) * width, animated: true }), AUTO_MS);
    return () => clearTimeout(t);
  }, [page, touched, reduceMotion, width, scroller]);

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.brand} accessibilityRole="header" accessibilityLabel="payvr">
        <LogoMark size={30} />
        <Text style={[styles.wordmark, { color: colors.text }]}>payvr</Text>
      </View>

      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setTouched(true)}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={styles.fill}>
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width, height: height || undefined }]}>
            <Parallax x={x} index={i} width={width} depth={0.35} style={styles.art}>
              {i === 0 ? <TapScene active={page === 0} /> : i === 1 ? <FoundScene active={page === 1} /> : <TrustScene active={page === 2} />}
            </Parallax>
            <Parallax x={x} index={i} width={width} depth={0} rise style={styles.copy}>
              <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                {s.title}
              </Text>
              <Text color="textSecondary" style={styles.body}>
                {s.body}
              </Text>
            </Parallax>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <PressableScale
            key={i}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Slide ${i + 1} of ${SLIDES.length}`}
            aria-selected={i === page}
            onPress={() => {
              setTouched(true);
              goTo(i);
            }}
            style={styles.dotHit}>
            <Dot x={x} index={i} width={width} on={colors.accent} off={colors.border} />
          </PressableScale>
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Get started" onPress={() => router.push('/phone')} />
        <Button label="Log in" variant="ghost" onPress={() => router.push({ pathname: '/phone', params: { mode: 'login' } })} />
      </View>
    </View>
  );
}

/**
 * Content that follows the swipe with depth: `depth` 0 moves with the page, higher lags behind.
 * It fades out toward the edges, and with `rise` the text also settles up as its page arrives.
 */
function Parallax({
  x,
  index,
  width,
  depth,
  rise,
  style,
  children,
}: {
  x: SharedValue<number>;
  index: number;
  width: number;
  depth: number;
  rise?: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  const animated = useAnimatedStyle(() => {
    const d = x.value - index * width;
    const near = interpolate(Math.abs(d), [0, width * 0.7], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: near,
      transform: [{ translateX: d * depth }, { translateY: rise ? 18 * (1 - near) : 0 }],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Page dot that stretches and turns blue as its page slides in, tracking your finger. */
function Dot({ x, index, width, on, off }: { x: SharedValue<number>; index: number; width: number; on: string; off: string }) {
  const style = useAnimatedStyle(() => {
    const p = interpolate(x.value / Math.max(1, width), [index - 1, index, index + 1], [0, 1, 0], Extrapolation.CLAMP);
    return { width: 8 + 18 * p, backgroundColor: interpolateColor(p, [0, 1], [off, on]) };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, height: 40 },
  wordmark: { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -1 },
  slide: { paddingHorizontal: 24, paddingBottom: 8 },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: 12 },
  title: { fontFamily: Fonts.bold, fontSize: 40, lineHeight: 44, letterSpacing: -1.6 },
  body: { maxWidth: 340, fontSize: 17, lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginVertical: 14 },
  dotHit: { minWidth: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 8, borderRadius: 4 },
  actions: { paddingHorizontal: 24, gap: 4 },
});
