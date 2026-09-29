import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Keypad } from '@/components/keypad';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { evenShares } from '@/data/chat';
import type { User } from '@/data/types';
import { useApp } from '@/store/app-store';
import { useChat } from '@/store/chat-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { applyKey, displayTyped, formatShort, toCents } from '@/utils/money';

/** You paid the bill: enter the total, pick who's in, and everyone gets their share to pay. */
export default function SplitBill() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, userById } = useApp();
  const { chatById, createSplit } = useChat();
  const chat = chatById(id);
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const others = (chat?.memberIds ?? []).filter((m) => m !== me.id).map((m) => userById(m)).filter((u): u is User => !!u);
  const [included, setIncluded] = useState<string[]>(others.map((u) => u.id));
  const cents = toCents(amount);
  const people = included.length + 1;
  const each = cents && people > 1 ? evenShares(cents, [me.id, ...included]) : [];
  const perPerson = each.length ? each[each.length - 1].cents : 0;
  const ready = cents >= people && included.length > 0 && !!note.trim();

  const toggle = (uid: string) => {
    haptics.tap();
    setIncluded((list) => (list.includes(uid) ? list.filter((x) => x !== uid) : [...list, uid]));
  };

  const go = () => {
    if (!chat || !ready) return;
    createSplit(chat.id, cents, note, included);
    haptics.success();
    router.back();
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.head}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <Text variant="heading" accessibilityRole="header">
          Split a bill
        </Text>
        <View style={{ width: MIN_TAP }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`Total ${displayTyped(amount)}`}
          style={[styles.amount, { color: cents ? colors.text : colors.textSecondary }]}>
          {displayTyped(amount)}
        </Text>
        <Text variant="small" color="textSecondary" align="center" accessibilityLiveRegion="polite">
          {perPerson ? `${formatShort(perPerson)} each · ${people} people, you included` : 'The whole bill, including your part'}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What was it for?"
          placeholderTextColor={colors.textSecondary}
          maxLength={40}
          accessibilityLabel="What was it for?"
          style={[styles.note, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
        <View style={styles.people}>
          {others.map((u) => {
            const on = included.includes(u.id);
            return (
              <PressableScale
                scaleTo={0.94}
                key={u.id}
                accessibilityRole="checkbox"
                accessibilityLabel={u.name}
                aria-checked={on}
                onPress={() => toggle(u.id)}
                style={({ pressed }) => [styles.person, { opacity: on ? 1 : 0.45 }]}>
                <View>
                  <Avatar name={u.name} uri={u.avatarUrl} size={52} ring={on} />
                  {on ? (
                    <View style={[styles.tick, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                      <Icon name="check" size={12} color={colors.onPrimary} strokeWidth={3} />
                    </View>
                  ) : null}
                </View>
                <Text variant="caption" numberOfLines={1}>
                  {u.name.split(' ')[0]}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <Keypad onKey={(k) => setAmount((a) => applyKey(a, k))} />
        <Button
          label={cents ? `Split ${formatShort(cents)}` : 'Split'}
          disabled={!ready}
          onPress={go}
          accessibilityHint="Posts the split in the chat so everyone can pay their share"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, minHeight: 52 },
  body: { alignItems: 'center', paddingHorizontal: 20, gap: 8, paddingTop: 8 },
  amount: { fontFamily: Fonts.bold, fontSize: 72, lineHeight: 80, letterSpacing: -3, fontVariant: ['tabular-nums'] },
  note: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    fontFamily: Fonts.medium,
    fontSize: 17,
    textAlign: 'center',
    marginTop: 8,
  },
  people: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 12 },
  person: { alignItems: 'center', gap: 4, width: 60 },
  tick: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: 20, gap: 10 },
});
