import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BRAND_NAME, CARD_FACE, type LinkedCard } from '@/data/cards';
import { Fonts } from '@/theme/typography';

import { Text } from './text';

const WHITE = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.7)';

/** A connected card, drawn like a real card: issuer, network name, chip, last 4, expiry. */
export function LinkedCardFace({ card, isDefault }: { card: LinkedCard; isDefault?: boolean }) {
  const exp = `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`;
  return (
    <View style={[styles.face, { backgroundColor: CARD_FACE[card.brand] }]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 214" preserveAspectRatio="xMaxYMin slice" pointerEvents="none">
        <Circle cx="360" cy="230" r="150" fill="none" stroke={WHITE} strokeOpacity={0.05} strokeWidth="30" />
      </Svg>
      <View style={styles.row}>
        <Text variant="bodyMedium" numberOfLines={1} style={styles.issuer}>
          {card.issuer}
        </Text>
        <Text style={styles.network}>{BRAND_NAME[card.brand]}</Text>
      </View>
      <View style={styles.chip} />
      <View style={styles.row}>
        <Text style={styles.digits}>•••• {card.last4}</Text>
        <View style={styles.right}>
          {isDefault ? (
            <View style={styles.badge}>
              <Text variant="caption" style={{ color: WHITE }}>
                Default
              </Text>
            </View>
          ) : null}
          <Text variant="caption" style={{ color: SOFT }}>
            {exp}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { flex: 1, borderRadius: 24, padding: 20, justifyContent: 'space-between', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  issuer: { color: WHITE, flexShrink: 1 },
  network: { color: WHITE, fontFamily: Fonts.bold, fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
  chip: { width: 44, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.22)' },
  digits: { color: WHITE, fontFamily: Fonts.medium, fontSize: 17, letterSpacing: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
});
