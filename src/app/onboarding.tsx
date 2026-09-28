import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { LogoGlyph } from '@/components/logo';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { MIN_TAP } from '@/theme/typography';

const SLIDES = [
  { title: "Tap phones.\nMoney's sent.", body: 'Type an amount, hold your phone near a friend’s, confirm. That’s it.' },
  { title: 'No usernames.\nNo mistakes.', body: 'Their name and photo appear on your screen before anything moves.' },
  { title: 'Only pay people\nright next to you.', body: 'Payvr only finds phones a few centimetres away, and only while the Tap screen is open.' },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [page, setPage] = useState(0);
  const [height, setHeight] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  return (
    <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={styles.fill}>
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width, height: height || undefined }]}>
            <View style={styles.art}>
              <Illustration index={i} />
            </View>
            <Text variant="display" accessibilityRole="header">
              {s.title}
            </Text>
            <Text color="textSecondary" style={styles.body}>
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Slide ${i + 1} of ${SLIDES.length}`}
            aria-selected={i === page}
            onPress={() => scroller.current?.scrollTo({ x: i * width, animated: true })}
            style={styles.dotHit}>
            <View
              style={[
                styles.dot,
                { backgroundColor: i === page ? colors.accent : colors.border, width: i === page ? 24 : 8 },
              ]}
            />
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Get started" onPress={() => router.push('/phone')} />
        <Button label="Log in" variant="ghost" onPress={() => router.push({ pathname: '/phone', params: { mode: 'login' } })} />
      </View>
    </View>
  );
}

function Illustration({ index }: { index: number }) {
  const { colors } = useTheme();
  if (index === 0) {
    // Two phones meeting, with the p between them.
    return (
      <View style={styles.center}>
        <Svg width={260} height={200} viewBox="0 0 260 200">
          <Rect x="20" y="30" width="80" height="150" rx="18" fill={colors.surface} stroke={colors.border} strokeWidth="2" />
          <Rect x="160" y="30" width="80" height="150" rx="18" fill={colors.surface} stroke={colors.border} strokeWidth="2" />
          <Circle cx="130" cy="105" r="46" fill="none" stroke={colors.primary} strokeOpacity="0.25" strokeWidth="2" />
          <Circle cx="130" cy="105" r="68" fill="none" stroke={colors.primary} strokeOpacity="0.12" strokeWidth="2" />
          <Circle cx="130" cy="105" r="30" fill={colors.primary} />
        </Svg>
        <View style={styles.glyphOver}>
          <LogoGlyph size={42} color="#FFFFFF" />
        </View>
      </View>
    );
  }
  if (index === 1) {
    return (
      <View style={[styles.personCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar name="Jake Rivera" size={72} ring />
        <Text variant="heading">Jake Rivera</Text>
        <Text color="textSecondary">@jake</Text>
      </View>
    );
  }
  return (
    <Svg width={220} height={200} viewBox="0 0 220 200">
      {[90, 66, 42].map((r, i) => (
        <Circle key={r} cx="110" cy="100" r={r} fill="none" stroke={colors.primary} strokeOpacity={0.15 + i * 0.25} strokeWidth="2" />
      ))}
      <Circle cx="110" cy="100" r="18" fill={colors.primary} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  slide: { paddingHorizontal: 24, justifyContent: 'flex-end', paddingBottom: 12 },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  glyphOver: { position: 'absolute', top: 84, left: 109 },
  body: { marginTop: 14, maxWidth: 340 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginVertical: 16 },
  dotHit: { minWidth: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 8, borderRadius: 4 },
  actions: { paddingHorizontal: 24, gap: 4 },
  personCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 28,
    paddingHorizontal: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
