import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TransactionRow } from '@/components/transaction-row';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';
import { shortTime } from '@/utils/dates';

export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { userById, transactions, contacts, me } = useApp();
  const person = userById(id);
  if (!person) return <Screen back="back">{null}</Screen>;

  const history = transactions.filter(
    (t) => (t.fromUser === person.id && t.toUser === me.id) || (t.toUser === person.id && t.fromUser === me.id),
  );
  const contact = contacts.find((c) => c.userId === person.id);

  return (
    <Screen back="back" scroll>
      <View style={styles.head}>
        <Avatar name={person.name} uri={person.avatarUrl} size={104} />
        <Text variant="title" align="center">
          {person.name}
        </Text>
        <Text color="textSecondary">@{person.handle}</Text>
        {contact ? (
          <Text variant="caption" color="textSecondary">
            Last tapped {shortTime(contact.lastTappedAt).toLowerCase()}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button
          label="Send"
          icon="send"
          style={styles.flex}
          onPress={() => router.push({ pathname: '/amount', params: { to: person.id, mode: 'send' } })}
        />
        <Button
          label="Request"
          icon="request"
          variant="secondary"
          style={styles.flex}
          onPress={() => router.push({ pathname: '/amount', params: { to: person.id, mode: 'request' } })}
        />
      </View>
      <Text variant="caption" color="textSecondary" style={styles.note}>
        You’ve tapped before, so you can pay {person.name.split(' ')[0]} remotely.
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text variant="heading" style={styles.section}>
        History
      </Text>
      {history.length ? (
        history.map((t) => <TransactionRow key={t.id} tx={t} />)
      ) : (
        <Text color="textSecondary">No payments yet.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 4, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 28 },
  flex: { flex: 1 },
  note: { textAlign: 'center', marginTop: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 24 },
  section: { marginBottom: 4 },
});
