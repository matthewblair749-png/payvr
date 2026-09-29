import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { PrivacyPicker } from '@/components/privacy-picker';
import { StoryCard } from '@/components/story-card';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';
import { useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts, MIN_TAP } from '@/theme/typography';
import { shortTime } from '@/utils/dates';

/** One feed item with its comments. On your own payments you can change who sees it. */
export default function StoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { userById, me } = useApp();
  const { storyById, addComment, setPrivacy } = useSocial();
  const [text, setText] = useState('');
  const story = storyById(id);

  const send = () => {
    if (!story || !text.trim()) return;
    addComment(story.id, text);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.head}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
        <Text variant="heading">Payment</Text>
        <View style={{ width: MIN_TAP }} />
      </View>
      {!story ? (
        <Text color="textSecondary" align="center" style={styles.empty}>
          This payment isn’t in your feed any more.
        </Text>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <StoryCard story={story} detail />
            {story.mine ? (
              <View style={styles.privacy}>
                <Text variant="caption" color="textSecondary" style={styles.label}>
                  WHO CAN SEE THIS
                </Text>
                <PrivacyPicker value={story.privacy} onChange={(p) => setPrivacy(story.id, p)} />
                <Button
                  label="View receipt"
                  variant="ghost"
                  size="md"
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: story.id } })}
                />
              </View>
            ) : null}
            <Text variant="caption" color="textSecondary" style={[styles.label, styles.commentsLabel]}>
              {story.comments.length ? `COMMENTS · ${story.comments.length}` : 'COMMENTS'}
            </Text>
            {story.comments.map((c) => {
              const u = c.userId === me.id ? me : userById(c.userId);
              return (
                <View key={c.id} style={styles.comment}>
                  <Avatar name={u?.name ?? '?'} uri={u?.avatarUrl} size={36} />
                  <View style={styles.flex}>
                    <Text variant="small">
                      <Text variant="small" style={styles.bold}>
                        {u?.name.split(' ')[0] ?? 'Someone'}
                      </Text>
                      <Text variant="small" color="textSecondary">
                        {'  '}
                        {shortTime(c.createdAt)}
                      </Text>
                    </Text>
                    <Text>{c.text}</Text>
                  </View>
                </View>
              );
            })}
            {!story.comments.length ? (
              <Text variant="small" color="textSecondary">
                Say something nice.
              </Text>
            ) : null}
          </ScrollView>
          <View style={[styles.compose, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Avatar name={me.name} uri={me.avatarUrl} size={36} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment"
              placeholderTextColor={colors.textSecondary}
              maxLength={280}
              returnKeyType="send"
              onSubmitEditing={send}
              accessibilityLabel="Add a comment"
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
            <IconButton icon="send" label="Post comment" onPress={send} />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, minHeight: 52 },
  content: { padding: 16, gap: 12 },
  privacy: { gap: 10, marginTop: 8 },
  label: { letterSpacing: 0.8 },
  commentsLabel: { marginTop: 12 },
  bold: { fontFamily: Fonts.bold },
  comment: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  compose: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: MIN_TAP, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, fontFamily: Fonts.regular, fontSize: 16 },
  empty: { marginTop: 64 },
});
