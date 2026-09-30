import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BRAND_NAME, cardLabel, type LinkedCard } from '@/data/cards';
import { useApp } from '@/store/app-store';
import { useAuthorize } from '@/store/authorize';
import { useCards } from '@/store/cards-store';
import { useTheme } from '@/theme/theme-provider';
import { haptics } from '@/utils/haptics';
import { EASE } from '@/utils/motion';

import { Button } from './button';
import { Icon } from './icon';
import { Card, ListRow, SectionLabel, ToggleRow } from './list-row';
import { Text } from './text';

const enter = (i: number) => FadeInDown.delay(40 + i * 60).duration(380).easing(EASE);

/** What you can do with a connected card, shown under the stack when it's on top. */
export function CardDetails({ card, onRemoved }: { card: LinkedCard; onRemoved: () => void }) {
  const { colors } = useTheme();
  const { setDraft } = useApp();
  const { defaultSource, setDefaultSource, removeCard } = useCards();
  const authorize = useAuthorize();
  const isDefault = defaultSource === card.id;
  const exp = `${String(card.expMonth).padStart(2, '0')}/${card.expYear}`;

  const payWithCard = () => {
    setDraft(null);
    router.push({ pathname: '/amount', params: { source: card.id } });
  };

  const remove = async () => {
    if (!(await authorize(`Remove ${cardLabel(card)}`))) return;
    removeCard(card.id);
    haptics.success();
    onRemoved();
  };

  return (
    <View>
      <Animated.View entering={enter(0)}>
        <Button label="Pay a friend with this card" icon="send" onPress={payWithCard} style={styles.cta} />
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Card style={styles.first}>
          <ToggleRow
            icon="star"
            label="Default for payments"
            value={isDefault}
            onChange={(v) => setDefaultSource(v ? card.id : 'balance')}
            last
          />
        </Card>
        <Text variant="small" color="textSecondary" style={styles.note}>
          {isDefault
            ? 'Tap payments use this card unless you pick something else.'
            : 'Tap payments use your Payvr balance. You can switch on each payment.'}
        </Text>
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <SectionLabel>Card details</SectionLabel>
        <Card>
          <ListRow label="Network" value={BRAND_NAME[card.brand]} />
          <ListRow label="Card number" value={`Ends in ${card.last4}`} />
          <ListRow label="Expires" value={exp} />
          <ListRow label="Issued by" value={card.issuer} last />
        </Card>
        <View style={styles.safe}>
          <Icon name="shield" size={14} color={colors.textSecondary} />
          <Text variant="caption" color="textSecondary" style={styles.flex}>
            Test card. Payvr keeps only the last 4 digits, never the full number or security code.
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <Card style={styles.remove}>
          <ListRow icon="delete" label="Remove card" danger onPress={remove} last />
        </Card>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cta: { marginTop: 20 },
  first: { marginTop: 16 },
  note: { marginTop: 10, marginLeft: 4 },
  safe: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, marginHorizontal: 4 },
  remove: { marginTop: 24 },
});
