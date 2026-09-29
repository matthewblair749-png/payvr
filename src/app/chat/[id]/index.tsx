import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { GroupAvatar } from '@/components/group-avatar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Text } from '@/components/text';
import type { ChatMessage, Split } from '@/data/chat';
import type { User } from '@/data/types';
import { useApp } from '@/store/app-store';
import { useChat } from '@/store/chat-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { haptics } from '@/utils/haptics';
import { formatCents, formatShort } from '@/utils/money';

export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { me, userById } = useApp();
  const { chatById, messagesFor, sendText, markRead, typing } = useChat();
  const [text, setText] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);
  const chat = chatById(id);
  const messages = messagesFor(id);
  const typingUser = typing[id] ? userById(typing[id]!) : undefined;

  // Reading the chat clears its unread count, including messages that arrive while open.
  useFocusEffect(
    useCallback(() => {
      markRead(id);
    }, [id, markRead]),
  );
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    markRead(id);
  }, [id, lastId, markRead]);

  if (!chat) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
        <Text color="textSecondary" align="center" style={styles.missing}>
          This chat isn’t available.
        </Text>
      </View>
    );
  }

  const members = chat.memberIds.map((m) => (m === me.id ? me : userById(m))).filter((u): u is User => !!u);
  const others = members.filter((u) => u.id !== me.id);

  const send = () => {
    if (!text.trim()) return;
    sendText(chat.id, text);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
      <View style={[styles.head, { borderBottomColor: colors.border }]}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
        <GroupAvatar members={others} size={40} />
        <View style={styles.flex}>
          <Text variant="bodyMedium" numberOfLines={1} accessibilityRole="header">
            {chat.name}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {members.map((u) => (u.id === me.id ? 'You' : u.name.split(' ')[0])).join(', ')}
          </Text>
        </View>
      </View>

      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => {
          const prev = messages[index - 1];
          const firstOfRun = !prev || prev.userId !== item.userId || prev.kind === 'system' || prev.kind === 'payment';
          return <MessageItem m={item} firstOfRun={firstOfRun} chatId={chat.id} />;
        }}
        ListFooterComponent={
          typingUser ? (
            <View style={styles.typing} accessibilityLiveRegion="polite">
              <Avatar name={typingUser.name} uri={typingUser.avatarUrl} size={24} />
              <Text variant="caption" color="textSecondary">
                {typingUser.name.split(' ')[0]} is typing…
              </Text>
            </View>
          ) : null
        }
      />

      <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Split a bill"
          onPress={() => {
            haptics.tap();
            router.push({ pathname: '/chat/[id]/split', params: { id: chat.id } });
          }}
          style={({ pressed }) => [styles.plus, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
          <Icon name="plus" size={22} color={colors.accent} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={colors.textSecondary}
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
          accessibilityLabel="Message"
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          aria-disabled={!text.trim()}
          onPress={send}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: text.trim() ? colors.primary : colors.surface, transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}>
          <Icon name="send" size={20} color={text.trim() ? colors.onPrimary : colors.textSecondary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageItem({ m, firstOfRun, chatId }: { m: ChatMessage; firstOfRun: boolean; chatId: string }) {
  const { colors } = useTheme();
  const { me, userById } = useApp();
  const mine = m.userId === me.id;
  const author = mine ? me : userById(m.userId);
  const first = (id: string) => (id === me.id ? 'you' : (userById(id)?.name.split(' ')[0] ?? 'someone'));

  if (m.kind === 'system') {
    return (
      <Text variant="caption" color="textSecondary" align="center" style={styles.system}>
        {m.text}
      </Text>
    );
  }

  if (m.kind === 'payment') {
    const toMe = m.toUser === me.id;
    const who = mine ? 'You' : (author?.name.split(' ')[0] ?? 'Someone');
    return (
      <Animated.View entering={FadeInUp.duration(250)} style={[styles.payment, { borderColor: colors.border }]}>
        <Icon name={toMe ? 'arrowDownLeft' : 'arrowUpRight'} size={16} color={toMe ? colors.successText : colors.accent} />
        <Text variant="caption" color={toMe ? 'successText' : 'textSecondary'}>
          {who} paid {first(m.toUser)} {formatShort(m.cents)} · {m.note}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={[styles.msgRow, mine && styles.msgRowMine, firstOfRun && styles.runGap]}>
      {!mine ? (
        <View style={styles.msgAvatar}>
          {firstOfRun && author ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${author.name}'s profile`}
              onPress={() => router.push({ pathname: '/person/[id]', params: { id: author.id } })}
              style={styles.avatarTap}>
              <Avatar name={author.name} uri={author.avatarUrl} size={30} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.msgCol, mine && styles.msgColMine]}>
        {!mine && firstOfRun ? (
          <Text variant="caption" color="textSecondary" style={styles.author}>
            {author?.name.split(' ')[0]}
          </Text>
        ) : null}
        {m.kind === 'text' ? (
          <View
            style={[
              styles.bubble,
              mine ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
            ]}>
            <Text style={mine ? { color: colors.onPrimary } : undefined}>{m.text}</Text>
          </View>
        ) : (
          <SplitCard split={m.split} chatId={chatId} />
        )}
      </View>
    </Animated.View>
  );
}

function SplitCard({ split, chatId }: { split: Split; chatId: string }) {
  const { colors } = useTheme();
  const { me, userById, setDraft } = useApp();
  const paid = split.shares.filter((s) => s.paidTxId).length;
  const owner = split.ownerId === me.id ? me : userById(split.ownerId);
  const ownerFirst = split.ownerId === me.id ? 'You' : (owner?.name.split(' ')[0] ?? 'Someone');
  const done = paid === split.shares.length;

  const payShare = (cents: number) => {
    haptics.tap();
    setDraft({ mode: 'send', amountCents: cents, note: split.note, peerId: split.ownerId, chatSplit: { chatId, splitId: split.id } });
    router.push('/confirm');
  };

  return (
    <View
      style={[styles.split, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={`${split.note}, ${formatCents(split.totalCents)}, split ${split.shares.length} ways. ${paid} of ${split.shares.length} paid.`}>
      <View style={styles.splitHead}>
        <View style={[styles.splitIcon, { backgroundColor: colors.background }]}>
          <Icon name="users" size={18} color={colors.accent} />
        </View>
        <View style={styles.flex}>
          <Text variant="caption" color="textSecondary">
            {ownerFirst} paid · split {split.shares.length} ways
          </Text>
          <Text variant="bodyMedium" numberOfLines={1}>
            {split.note}
          </Text>
        </View>
        <Text style={[styles.splitTotal, { color: colors.text }]}>{formatShort(split.totalCents)}</Text>
      </View>

      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fillBar, { backgroundColor: done ? colors.success : colors.accent, width: `${(paid / split.shares.length) * 100}%` }]} />
      </View>
      <Text variant="caption" color={done ? 'successText' : 'textSecondary'}>
        {done ? 'Everyone’s paid' : `${paid} of ${split.shares.length} paid`}
      </Text>

      {split.shares.map((s) => {
        const u = s.userId === me.id ? me : userById(s.userId);
        const isOwner = s.userId === split.ownerId;
        const mineToPay = s.userId === me.id && !s.paidTxId && !isOwner;
        return (
          <View key={s.userId} style={styles.share}>
            <Avatar name={u?.name ?? '?'} uri={u?.avatarUrl} size={28} />
            <Text variant="small" numberOfLines={1} style={styles.flex}>
              {s.userId === me.id ? 'You' : u?.name.split(' ')[0]}
            </Text>
            <Text variant="amount">{formatShort(s.cents)}</Text>
            {mineToPay ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pay your share, ${formatShort(s.cents)} to ${ownerFirst}`}
                onPress={() => payShare(s.cents)}
                style={({ pressed }) => [styles.payPill, { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
                <Text variant="caption" style={{ color: colors.onPrimary }}>
                  Pay
                </Text>
              </Pressable>
            ) : isOwner ? (
              <Text variant="caption" color="textSecondary" style={styles.statusText}>
                Paid bill
              </Text>
            ) : s.paidTxId ? (
              <View style={styles.status} accessibilityLabel="Paid">
                <Icon name="check" size={16} color={colors.accent} strokeWidth={2.6} />
              </View>
            ) : (
              <Text variant="caption" color="textSecondary" style={styles.statusText}>
                Waiting
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  missing: { marginTop: 64 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 4,
    paddingRight: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  messages: { paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  system: { marginVertical: 10 },
  payment: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 8,
  },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' },
  msgRowMine: { justifyContent: 'flex-end' },
  runGap: { marginTop: 8 },
  msgAvatar: { width: 30 },
  // 44pt tap area around the 30pt face, without moving it.
  avatarTap: { width: MIN_TAP, height: MIN_TAP, margin: -7, alignItems: 'center', justifyContent: 'center' },
  msgCol: { maxWidth: '78%', gap: 3 },
  msgColMine: { alignItems: 'flex-end' },
  author: { marginLeft: 12 },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  split: { width: 280, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  splitHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  splitTotal: { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fillBar: { height: 6, borderRadius: 3 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  payPill: { minHeight: MIN_TAP, minWidth: 64, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginVertical: -4 },
  status: { minWidth: 64, alignItems: 'center' },
  statusText: { minWidth: 64, textAlign: 'center' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginLeft: 0 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  plus: { width: MIN_TAP, height: MIN_TAP, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: MIN_TAP, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, fontFamily: Fonts.regular, fontSize: 16 },
  send: { width: MIN_TAP, height: MIN_TAP, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
