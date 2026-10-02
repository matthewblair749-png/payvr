import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Icon } from '@/components/icon';
import { Card, ListRow, SectionLabel } from '@/components/list-row';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { Footnote, Section } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';

/** Edit your name and photo. The @handle and phone number are shown but changed elsewhere. */
export default function EditProfile() {
  const { colors } = useTheme();
  const { me, updateProfile } = useApp();
  const [name, setName] = useState(me.name);
  const [photo, setPhoto] = useState(me.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = name.trim() !== me.name || photo !== (me.avatarUrl ?? null);
  const valid = name.trim().length >= 2;

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled) setPhoto(res.assets[0].uri);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ name: name.trim(), avatarUrl: photo });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save your profile. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back="back" title="Edit profile" scroll footer={<Button label="Save" disabled={!changed || !valid} loading={busy} onPress={save} />}>
      <Section index={0} style={styles.top}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={photo ? 'Change profile photo' : 'Add profile photo'}
          onPress={pickPhoto}
          style={styles.photo}>
          <Avatar name={name || me.name} uri={photo} size={104} />
          <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <Icon name="camera" size={18} color={colors.onPrimary} />
          </View>
        </PressableScale>
        {photo ? (
          <PressableScale accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)} style={styles.remove}>
            <Text variant="small" color="accent">
              Remove photo
            </Text>
          </PressableScale>
        ) : null}
      </Section>

      <Section index={1}>
        <Field label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={valid ? error : 'Enter at least 2 characters.'} />
      </Section>

      <Section index={2}>
        <SectionLabel>Account</SectionLabel>
        <Card>
          <ListRow icon="user" label="Handle" value={`@${me.handle}`} />
          <ListRow icon="phone" label="Phone" value={me.phone ?? 'Verified'} last />
        </Card>
        <Footnote>Your handle is how people find you, so it stays the same. To change your phone number, contact support; we’ll verify the new number by SMS.</Footnote>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', marginTop: 8, marginBottom: 20, gap: 4 },
  photo: { alignSelf: 'center' },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  remove: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
});
