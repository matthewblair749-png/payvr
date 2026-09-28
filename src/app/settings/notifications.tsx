import { Linking, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Card, ToggleRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useApp } from '@/store/app-store';

export default function Notifications() {
  const { settings, updateSettings, push, backendMode } = useApp();
  const on = settings.notificationsOn;

  const problem =
    !on || !push || 'token' in push
      ? null
      : push.error === 'denied'
        ? { text: 'Notifications are turned off for Payvr in your phone’s Settings.', settings: true }
        : push.error === 'unsupported'
          ? { text: 'Push notifications need a real phone (not a simulator or the web preview).', settings: false }
          : push.error === 'no_project'
            ? { text: 'Push isn’t set up for this build yet: it needs an EAS project ID (see docs/PUSH.md).', settings: false }
            : { text: 'Couldn’t turn on push notifications. Try again later.', settings: false };

  return (
    <Screen back="back" title="Notifications">
      <Card style={styles.card}>
        <ToggleRow label="Push notifications" last={!on} value={on} onChange={(v) => updateSettings({ notificationsOn: v })} />
        {on ? (
          <>
            <ToggleRow label="Money received" value={settings.notifyPayments} onChange={(v) => updateSettings({ notifyPayments: v })} />
            <ToggleRow label="Requests" last value={settings.notifyRequests} onChange={(v) => updateSettings({ notifyRequests: v })} />
          </>
        ) : null}
      </Card>
      <Text variant="small" color="textSecondary" style={styles.note}>
        For example: “Jake paid you $20 · Pizza”.
        {backendMode === 'mock' ? ' (Prototype mock mode: pushes are sent once Supabase is connected.)' : ''}
      </Text>
      {problem ? (
        <>
          <Text variant="small" color="error" style={styles.note}>
            {problem.text}
          </Text>
          {problem.settings ? (
            <Button label="Open Settings" variant="secondary" size="md" onPress={() => Linking.openSettings()} style={styles.button} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12 },
  note: { marginTop: 10, marginLeft: 4 },
  button: { marginTop: 12 },
});
