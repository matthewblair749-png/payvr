import { StyleSheet, View } from 'react-native';

import { PayvrLogo } from '@/components/payvr-logo';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { Footnote, Radio, Section, SettingsHero } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';
import { BRAND_BLUE, Colors, type ColorScheme, type ThemePreference } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'dark', label: 'Dark', hint: 'The default look' },
  { value: 'light', label: 'Light', hint: 'Bright and clean' },
  { value: 'system', label: 'System', hint: 'Matches your phone' },
];

export default function Appearance() {
  const { colors, preference, setPreference } = useTheme();
  const { saveTheme } = useApp();
  return (
    <Screen back="back" scroll>
      <SettingsHero icon="moon" title="Appearance" body="Choose how Payvr looks. Your choice is saved on this device." />
      <Section index={1} style={styles.grid}>
        {OPTIONS.map((o) => {
          const active = preference === o.value;
          return (
            <PressableScale
              key={o.value}
              scaleTo={0.96}
              haptic="tap"
              accessibilityRole="radio"
              accessibilityLabel={`${o.label}. ${o.hint}`}
              aria-checked={active}
              onPress={() => {
                setPreference(o.value);
                saveTheme(o.value);
              }}
              style={styles.option}>
              <View style={[styles.frame, { borderColor: active ? colors.primary : colors.border }]}>
                {o.value === 'system' ? (
                  <View style={styles.split}>
                    <View style={styles.half}>
                      <MiniPhone scheme="light" offset />
                    </View>
                    <View style={[styles.half, styles.halfRight]}>
                      <MiniPhone scheme="dark" offset />
                    </View>
                  </View>
                ) : (
                  <MiniPhone scheme={o.value} />
                )}
              </View>
              <View style={styles.caption}>
                <Radio on={active} />
                <Text variant="bodyMedium">{o.label}</Text>
              </View>
            </PressableScale>
          );
        })}
      </Section>
      <Section index={2}>
        <Footnote>System follows your phone’s dark mode setting automatically, day and night.</Footnote>
      </Section>
    </Screen>
  );
}

/** A tiny sketch of the Home screen in a given theme. */
function MiniPhone({ scheme, offset }: { scheme: ColorScheme; offset?: boolean }) {
  const c = Colors[scheme];
  return (
    <View style={[styles.mini, { backgroundColor: c.background }, offset && styles.miniOffset]}>
      <View style={styles.miniTop}>
        <View style={[styles.dot, { backgroundColor: c.border }]} />
        <View style={[styles.line, { width: 26, backgroundColor: c.border }]} />
      </View>
      <View style={[styles.amount, { backgroundColor: c.text }]} />
      <View style={[styles.line, { width: 40, alignSelf: 'center', backgroundColor: c.surface === c.background ? c.border : c.surface }]} />
      <View style={styles.flexFill} />
      <View style={styles.buttons}>
        <View style={[styles.btn, { borderColor: c.border, borderWidth: 1 }]} />
        <View style={[styles.btn, { backgroundColor: BRAND_BLUE }]}>
          <PayvrLogo size={10} color="#FFFFFF" cutColor={BRAND_BLUE} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 10, marginTop: 20 },
  option: { flex: 1, gap: 10 },
  frame: { borderRadius: 20, borderWidth: 2, padding: 4, aspectRatio: 0.62 },
  split: { flex: 1, flexDirection: 'row', borderRadius: 15, overflow: 'hidden' },
  half: { width: '50%', overflow: 'hidden' },
  halfRight: { alignItems: 'flex-end' },
  caption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },

  mini: { flex: 1, borderRadius: 15, padding: 8, gap: 6 },
  miniOffset: { width: '200%' },
  miniTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { height: 5, borderRadius: 3 },
  amount: { width: 34, height: 14, borderRadius: 4, alignSelf: 'center', marginTop: 14 },
  flexFill: { flex: 1 },
  buttons: { flexDirection: 'row', gap: 4 },
  btn: { flex: 1, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
