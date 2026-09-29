import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import type { User } from '@/data/types';
import { useApp } from '@/store/app-store';
import { useChat } from '@/store/chat-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';

/** Start a group with people you've paid or tapped. */
export default function NewGroup() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { contacts, userById, me } = useApp();
  const { createChat } = useChat();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const people = useMemo(
    () => contacts.map((c) => userById(c.userId)).filter((u): u is User => !!u && u.id !== me.id),
    [contacts, userById, me.id],
  );

  const toggle = (id: string) => {
    haptics.tap();
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };

  const create = () => {
    if (!picked.length) return;
    const fallback = picked.map((id) => userById(id)?.name.split(' ')[0]).filter(Boolean).slice(0, 3).join(', ');
    const id = createChat(name.trim() || fallback, picked);
    haptics.success();
    router.replace({ pathname: '/chat/[id]', params: { id } });
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.head}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <Text variant="heading" accessibilityRole="header">
          New group
        </Text>
        <View style={{ width: MIN_TAP }} />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Group name"
        placeholderTextColor={colors.textSecondary}
        maxLength={40}
        accessibilityLabel="Group name"
        style={[styles.name, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
      />

      <Text variant="caption" color="textSecondary" style={styles.label}>
        {picked.length ? `${picked.length + 1} PEOPLE, YOU INCLUDED` : 'ADD PEOPLE'}
      </Text>
      <ScrollView contentContainerStyle={styles.list}>
        {people.map((u) => {
          const on = picked.includes(u.id);
          return (
            <PressableScale
              scaleTo={0.985}
              key={u.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`${u.name}, @${u.handle}`}
              aria-checked={on}
              onPress={() => toggle(u.id)}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surface : 'transparent' }]}>
              <Avatar name={u.name} uri={u.avatarUrl} size={44} />
              <View style={styles.flex}>
                <Text variant="bodyMedium">{u.name}</Text>
                <Text variant="small" color="textSecondary">
                  @{u.handle}
                </Text>
              </View>
              <View
                style={[
                  styles.check,
                  { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : 'transparent' },
                ]}>
                {on ? <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} /> : null}
              </View>
            </PressableScale>
          );
        })}
        {!people.length ? (
          <Text color="textSecondary" align="center" style={styles.empty}>
            Pay or tap phones with someone first, then you can add them to a group.
          </Text>
        ) : null}
      </ScrollView>

      <Button label="Start group" disabled={!picked.length} onPress={create} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, minHeight: 52 },
  name: {
    marginHorizontal: 20,
    marginTop: 8,
    minHeight: 52,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    fontFamily: Fonts.medium,
    fontSize: 17,
  },
  label: { letterSpacing: 0.8, marginTop: 24, marginBottom: 6, marginHorizontal: 24 },
  list: { paddingHorizontal: 12, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 12, borderRadius: 16 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: 40, paddingHorizontal: 24 },
  cta: { marginHorizontal: 20 },
});
