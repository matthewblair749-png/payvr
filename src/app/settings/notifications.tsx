import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Card, ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { useApp } from '@/store/app-store';

export default function Notifications() {
  const { settings, updateSettings } = useApp();
  const [requests, setRequests] = useState(true);
  const on = settings.notificationsOn;
  return (
    <Screen back="back" title="Notifications">
      <Card style={styles.card}>
        <ListRow
          label="Push notifications"
          last={!on}
          right={<Toggle label="Push notifications" value={on} onChange={(v) => updateSettings({ notificationsOn: v })} />}
        />
        {on ? (
          <>
            <ListRow label="Money received" right={<Toggle label="Money received" value onChange={() => {}} />} />
            <ListRow label="Requests" last right={<Toggle label="Requests" value={requests} onChange={setRequests} />} />
          </>
        ) : null}
      </Card>
      <Text variant="small" color="textSecondary" style={styles.note}>
        For example: “Jake paid you $20 · Pizza”.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12 },
  note: { marginTop: 10, marginLeft: 4 },
});
