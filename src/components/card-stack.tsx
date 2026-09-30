import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { smooth } from '@/utils/motion';

import { PressableScale } from './pressable-scale';

export type StackItem = { key: string; label: string; node: React.ReactNode };

/** How much of each tucked card shows below the chosen one (a tap target, like a wallet). */
const PEEK = 56;
const GAP = 14;

/**
 * Wallet-style card stack: the chosen card sits on top at full size; the rest tuck in below,
 * each showing its top edge. Tap a tucked card and the cards glide into their new places.
 */
export function CardStack({ items, selected, onSelect, sidePadding = 20 }: { items: StackItem[]; selected: string; onSelect: (key: string) => void; sidePadding?: number }) {
  const { width } = useWindowDimensions();
  const cardH = Math.round((Math.min(width, 520) - sidePadding * 2) / 1.586);
  const others = items.filter((i) => i.key !== selected);
  const height = cardH + (others.length ? GAP + others.length * PEEK : 0);

  return (
    <View style={[styles.stack, { height }]}>
      {items.map((item) => {
        const isSel = item.key === selected;
        const k = others.findIndex((o) => o.key === item.key);
        const top = isSel ? 0 : cardH + GAP + k * PEEK;
        return (
          <StackCard key={item.key} top={top} height={cardH} z={isSel ? 100 : k + 1}>
            {item.node}
            {!isSel ? (
              <PressableScale
                scaleTo={1}
                haptic="tap"
                accessibilityRole="button"
                accessibilityLabel={`Show ${item.label}`}
                onPress={() => onSelect(item.key)}
                style={[styles.peekHit, { height: PEEK }]}
              />
            ) : null}
          </StackCard>
        );
      })}
    </View>
  );
}

function StackCard({ top, height, z, children }: { top: number; height: number; z: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(top);
  useEffect(() => {
    y.set(reduceMotion ? top : withTiming(top, smooth(460)));
  }, [top, y, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.card, { height, zIndex: z }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  stack: { overflow: 'hidden' },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    borderRadius: 24,
    // A thin shadow separates stacked cards (a shadow, not a gradient).
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  peekHit: { position: 'absolute', left: 0, right: 0, top: 0 },
});
