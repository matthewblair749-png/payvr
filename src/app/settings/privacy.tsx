import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { SectionLabel } from '@/components/list-row';
import { PRIVACY_OPTIONS, privacyIcon } from '@/components/privacy-picker';
import { Screen } from '@/components/screen';
import { ChoiceCard, Footnote, Section, SettingsHero } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';
import { PRIVACY_LABEL, useSocial } from '@/store/social-store';
import { useTheme } from '@/theme/theme-provider';
import { Fonts } from '@/theme/typography';

const AUDIENCE = { public: 'Anyone on Payvr sees this', friends: 'Your friends see this', private: 'Only you and Jake see this' } as const;

/** Who sees new payments in the feed by default. You can still change it on each payment. */
export default function PrivacySettings() {
  const { colors } = useTheme();
  const { me, userById } = useApp();
  const { defaultPrivacy, setDefaultPrivacy } = useSocial();
  const jake = userById('u_jake');

  return (
    <Screen back="back" scroll>
      <SettingsHero icon="globe" title="Privacy" body="Choose who sees your new payments in the feed. Amounts are never shown to anyone else." />

      <Section index={1} style={styles.choices}>
        {PRIVACY_OPTIONS.map((o) => (
          <ChoiceCard
            key={o.value}
            icon={o.icon}
            label={o.label}
            hint={o.hint}
            selected={defaultPrivacy === o.value}
            onPress={() => setDefaultPrivacy(o.value)}
          />
        ))}
      </Section>

      <Section index={2}>
        <SectionLabel>Preview</SectionLabel>
        <View
          accessible
          accessibilityLabel={`Preview: ${AUDIENCE[defaultPrivacy]}. You paid Jake for pizza. The amount is hidden.`}
          style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.faces}>
            <Avatar name={me.name} uri={me.avatarUrl} size={40} />
            <View style={[styles.second, { borderColor: colors.surface }]}>
              <Avatar name={jake?.name ?? 'Jake'} uri={jake?.avatarUrl} size={22} />
            </View>
          </View>
          <View style={styles.flex}>
            <View style={styles.who}>
              <Text variant="bodyMedium" style={styles.bold}>
                You
              </Text>
              <Icon name="chevronRight" size={13} color={colors.textSecondary} strokeWidth={2.6} />
              <Text variant="bodyMedium" style={styles.bold}>
                Jake
              </Text>
            </View>
            <Text style={[styles.note, { color: colors.text }]}>🍕 Pizza night</Text>
            <View style={styles.meta}>
              <Icon name={privacyIcon(defaultPrivacy)} size={13} color={colors.textSecondary} />
              <Text variant="caption" color="textSecondary">
                {PRIVACY_LABEL[defaultPrivacy]} · amount hidden
              </Text>
            </View>
          </View>
        </View>
        <Text variant="small" color="textSecondary" style={styles.audience}>
          {AUDIENCE[defaultPrivacy]}.
        </Text>
      </Section>

      <Section index={3}>
        <Footnote>You can still change who sees any payment when you send it, or later from the feed.</Footnote>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 10, marginTop: 20 },
  preview: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  faces: { width: 44, height: 44 },
  second: { position: 'absolute', right: -4, bottom: -2, borderWidth: 2, borderRadius: 13 },
  flex: { flex: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bold: { fontFamily: Fonts.bold },
  note: { fontFamily: Fonts.medium, fontSize: 18, lineHeight: 24, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  audience: { marginTop: 8, marginLeft: 4 },
});
