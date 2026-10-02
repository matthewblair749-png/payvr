import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { StepHeader } from '@/components/step-header';
import { Text } from '@/components/text';
import { resetAccountForSignup } from '@/store/account';
import { useApp } from '@/store/app-store';
import { signupDraft } from '@/store/signup-draft';
import { useTheme } from '@/theme/theme-provider';

const HANDLE_RE = /^[a-z0-9_.]{3,20}$/;

export default function ProfileSetup() {
  const { colors } = useTheme();
  const { handleAvailable } = useApp();
  const [name, setName] = useState(signupDraft.name);
  const [handle, setHandle] = useState(signupDraft.handle);
  const [photo, setPhoto] = useState<string | null>(signupDraft.avatarUrl);

  const [checked, setChecked] = useState<{ handle: string; available: boolean } | null>(null);
  const taken = checked?.handle === handle && !checked.available;

  // Check the handle with the server as you type (debounced).
  useEffect(() => {
    if (!HANDLE_RE.test(handle)) return;
    let live = true;
    const t = setTimeout(() => {
      handleAvailable(handle).then((available) => live && setChecked({ handle, available }));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [handle, handleAvailable]);

  const handleError =
    handle.length === 0
      ? null
      : !HANDLE_RE.test(handle)
        ? '3–20 characters: letters, numbers, dots or underscores.'
        : taken
          ? 'That handle is taken.'
          : null;
  const valid = name.trim().length >= 2 && HANDLE_RE.test(handle) && !taken;

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    // Supabase Storage upload (avatars bucket) happens in build step 3.
    if (!res.canceled) setPhoto(res.assets[0].uri);
  };

  return (
    <Screen
      back="back"
      scroll
      footer={
        <Button
          label="Continue"
          disabled={!valid}
          onPress={() => {
            Object.assign(signupDraft, { name: name.trim(), handle, avatarUrl: photo });
            resetAccountForSignup();
            router.push('/verify');
          }}
        />
      }>
      <StepHeader step={3} total={6} title="Make it yours" subtitle="This is what people see when you tap phones." />

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={photo ? 'Change profile photo' : 'Add profile photo'}
        onPress={pickPhoto}
        style={styles.photo}>
        <Avatar name={name || 'You'} uri={photo} size={104} />
        <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          <Icon name="camera" size={18} color={colors.onPrimary} />
        </View>
      </PressableScale>
      <Text variant="small" color="accent" align="center" style={styles.photoLabel}>
        {photo ? 'Change photo' : 'Add a photo'}
      </Text>

      <View style={styles.fields}>
        <Field label="Your name" placeholder="Matthew Cooper" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
        <Field
          label="Handle"
          prefix="@"
          placeholder="matthew"
          autoCapitalize="none"
          autoCorrect={false}
          value={handle}
          onChangeText={(t) => setHandle(t.toLowerCase().replace(/\s/g, ''))}
          error={handleError}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { alignSelf: 'center' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: { marginTop: 10, marginBottom: 20 },
  fields: { gap: 18 },
});
