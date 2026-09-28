import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Text } from '@/components/text';
import type { TapMode, User } from '@/data/types';
import { useApp } from '@/store/app-store';
import { useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { shortTime } from '@/utils/dates';
import { haptics } from '@/utils/haptics';
import { formatShort } from '@/utils/money';

/**
 * Who to pay (or request from). Search by name or @handle; favorites and recent people are
 * big avatars; people you've tapped phones with are marked, since you've met them in person.
 * Without an amount it's a plain people browser that opens profiles.
 */
export default function People() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: TapMode; amount?: string }>();
  const { contacts, userById, lookupHandle, setDraft, me } = useApp();
  const { favorites } = useSocial();
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<{ q: string; user: User | null } | null>(null);

  const mode: TapMode = params.mode === 'request' ? 'request' : 'send';
  const cents = Number(params.amount) || 0;
  const picking = cents > 0;

  const known = useMemo(
    () =>
      contacts
        .map((c) => ({ contact: c, user: userById(c.userId) }))
        .filter((x): x is { contact: typeof x.contact; user: User } => !!x.user && x.user.id !== me.id),
    [contacts, userById, me.id],
  );
  const favUsers = favorites.map((id) => userById(id)).filter((u): u is User => !!u);
  const recent = known.slice(0, 8).map((x) => x.user);
  const tapped = known.filter((x) => x.contact.viaTap);

  const q = query.trim().replace(/^@/, '').toLowerCase();
  const matches = q
    ? known.filter((x) => x.user.name.toLowerCase().includes(q) || x.user.handle.toLowerCase().includes(q))
    : [];

  // Also look the exact @handle up on the server, for people you haven't paid yet.
  useEffect(() => {
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      lookupHandle(q)
        .then((u) => live && setLookup({ q, user: u && u.id !== me.id ? u : null }))
        .catch(() => live && setLookup({ q, user: null }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, lookupHandle, me.id]);
  const remote = lookup?.q === q ? lookup.user : null;

  const results = remote && !matches.some((m) => m.user.id === remote.id) ? [...matches.map((m) => m.user), remote] : matches.map((m) => m.user);

  const choose = (u: User) => {
    haptics.tap();
    if (!picking) {
      router.push({ pathname: '/person/[id]', params: { id: u.id } });
      return;
    }
    setDraft({ mode, amountCents: cents, note: '', peerId: u.id });
    router.replace('/confirm');
  };

  const isTapped = (id: string) => tapped.some((t) => t.user.id === id);

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.head}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <Text variant="heading" accessibilityRole="header">
          {picking ? `${mode === 'send' ? 'Pay' : 'Request'} ${formatShort(cents)}` : 'People'}
        </Text>
        <View style={{ width: MIN_TAP }} />
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="search" size={20} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Name or @handle"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={false}
          accessibilityLabel="Search people by name or @handle"
          style={[styles.input, { color: colors.text }]}
        />
        {query ? <IconButton icon="close" label="Clear search" onPress={() => setQuery('')} /> : null}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {q ? (
          <>
            {results.map((u) => (
              <PersonRow key={u.id} user={u} tapped={isTapped(u.id)} onPress={() => choose(u)} />
            ))}
            {results.length === 0 ? (
              <Text color="textSecondary" align="center" style={styles.empty}>
                No one found for “{query.trim()}”. Check the @handle, or tap phones to meet in person.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            {favUsers.length ? <AvatarStrip title="Favorites" users={favUsers} onPick={choose} isTapped={isTapped} /> : null}
            {recent.length ? <AvatarStrip title="Recent" users={recent} onPick={choose} isTapped={isTapped} /> : null}

            <View style={styles.sectionHead}>
              <Text variant="caption" color="textSecondary" style={styles.label} accessibilityRole="header">
                TAPPED NEARBY
              </Text>
              <Text variant="caption" color="textSecondary">
                Met in person
              </Text>
            </View>
            {tapped.length ? (
              tapped.map(({ user, contact }) => (
                <PersonRow
                  key={user.id}
                  user={user}
                  tapped
                  detail={`Tapped · ${shortTime(contact.lastTappedAt)}`}
                  onPress={() => choose(user)}
                />
              ))
            ) : (
              <Text variant="small" color="textSecondary" style={styles.none}>
                People you tap phones with show up here.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AvatarStrip({
  title,
  users,
  onPick,
  isTapped,
}: {
  title: string;
  users: User[];
  onPick: (u: User) => void;
  isTapped: (id: string) => boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.strip}>
      <Text variant="caption" color="textSecondary" style={styles.label} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripRow}>
        {users.map((u) => (
          <Pressable
            key={u.id}
            accessibilityRole="button"
            accessibilityLabel={`${u.name}, @${u.handle}`}
            onPress={() => onPick(u)}
            style={({ pressed }) => [styles.big, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
            <Avatar
              name={u.name}
              uri={u.avatarUrl}
              size={68}
              badge={isTapped(u.id) ? { icon: 'payvr', color: colors.accent, label: 'Tapped in person' } : undefined}
            />
            <Text variant="caption" numberOfLines={1} align="center">
              {u.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function PersonRow({ user, tapped, detail, onPress }: { user: User; tapped?: boolean; detail?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${user.name}, @${user.handle}${tapped ? ', tapped in person' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surface : 'transparent' }]}>
      <Avatar
        name={user.name}
        uri={user.avatarUrl}
        size={48}
        badge={tapped ? { icon: 'payvr', color: colors.accent, label: 'Tapped in person' } : undefined}
      />
      <View style={styles.flex}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {user.name}
        </Text>
        <Text variant="small" color="textSecondary" numberOfLines={1}>
          @{user.handle}
          {detail ? ` · ${detail}` : ''}
        </Text>
      </View>
      <Icon name="chevronRight" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, minHeight: 52 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 4,
    paddingLeft: 16,
    minHeight: 52,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontFamily: Fonts.medium, fontSize: 17, minHeight: 48 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  strip: { marginTop: 18, gap: 10 },
  stripRow: { gap: 14, paddingRight: 20 },
  big: { width: 76, alignItems: 'center', gap: 6 },
  label: { letterSpacing: 0.8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 16 },
  empty: { marginTop: 40, paddingHorizontal: 16 },
  none: { marginTop: 8 },
});
