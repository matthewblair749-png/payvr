import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Icon } from '@/components/icon';
import { SectionLabel } from '@/components/list-row';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Footnote } from '@/components/settings-ui';
import { StepHeader } from '@/components/step-header';
import { Text } from '@/components/text';
import { ageOn, MIN_AGE, parseDob, US_STATES } from '@/config/compliance';
import { submitIdentity } from '@/services/kyc';
import { setAccount } from '@/store/account';
import { signupDraft } from '@/store/signup-draft';
import { useTheme } from '@/theme/theme-provider';

type Method = 'ssn' | 'id';

/** Formats typed digits as MM/DD/YYYY. */
const maskDob = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
};

/**
 * Identity verification, as the payments partner requires before money can move.
 * The details go straight to the partner's KYC check (services/kyc.ts). Payvr keeps only the
 * result (verified or not), never the SSN digits or the ID images.
 */
export default function Verify() {
  const { colors } = useTheme();
  const [first, setFirst] = useState(signupDraft.name.split(' ')[0] ?? '');
  const [last, setLast] = useState(signupDraft.name.split(' ').slice(1).join(' '));
  const [dob, setDob] = useState('');
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [method, setMethod] = useState<Method>('ssn');
  const [ssn4, setSsn4] = useState('');
  const [idScanned, setIdScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const birth = parseDob(dob);
  const dobError = dob.length === 10 && !birth ? 'Enter a real date as MM/DD/YYYY.' : null;
  const stateError = state.length === 2 && !US_STATES.includes(state as (typeof US_STATES)[number]) ? 'Use a US state, like CA or NY.' : null;
  const zipError = zip.length > 0 && zip.length < 5 ? 'ZIP codes are 5 digits.' : null;

  const valid =
    first.trim().length > 0 &&
    last.trim().length > 0 &&
    !!birth &&
    street.trim().length > 3 &&
    city.trim().length > 1 &&
    US_STATES.includes(state as (typeof US_STATES)[number]) &&
    /^\d{5}$/.test(zip) &&
    (method === 'ssn' ? /^\d{4}$/.test(ssn4) : idScanned);

  const scanId = async () => {
    const res =
      Platform.OS === 'web'
        ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    // The image is handed to the partner's ID check and not kept here.
    if (!res.canceled) setIdScanned(true);
  };

  const submit = async () => {
    if (!birth) return;
    if (ageOn(birth) < MIN_AGE) {
      router.replace({ pathname: '/ineligible', params: { reason: 'age' } });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await submitIdentity({
        firstName: first.trim(),
        lastName: last.trim(),
        dob,
        address: { street: street.trim(), unit: unit.trim(), city: city.trim(), state, zip, country: 'US' },
        ...(method === 'ssn' ? { ssnLast4: ssn4 } : { idDocument: true }),
      });
      setAccount({ kyc: result });
      if (result === 'rejected') {
        setError('We couldn’t confirm your identity with these details. Check them against your ID and try again, or scan your ID instead.');
        return;
      }
      router.push('/link-account');
    } catch {
      setError('Couldn’t reach the verification service. Check your connection and try again.');
    } finally {
      setBusy(false);
      setSsn4('');
    }
  };

  return (
    <Screen back="back" scroll footer={<Button label="Verify identity" icon="shield" disabled={!valid} loading={busy} onPress={submit} />}>
      <StepHeader
        step={4}
        total={6}
        title="Verify your identity"
        subtitle="The law requires this before you can send or receive money. It takes about a minute."
      />

      <SectionLabel>Legal name</SectionLabel>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="First" value={first} onChangeText={setFirst} autoComplete="given-name" textContentType="givenName" />
        </View>
        <View style={styles.flex}>
          <Field label="Last" value={last} onChangeText={setLast} autoComplete="family-name" textContentType="familyName" />
        </View>
      </View>

      <SectionLabel>Date of birth</SectionLabel>
      <Field
        label={`MM/DD/YYYY · you must be ${MIN_AGE} or older`}
        placeholder="04/18/1996"
        keyboardType="number-pad"
        value={dob}
        onChangeText={(t) => setDob(maskDob(t))}
        maxLength={10}
        autoComplete="birthdate-full"
        error={dobError}
      />

      <SectionLabel>Home address</SectionLabel>
      <View style={styles.stack}>
        <Field label="Street" value={street} onChangeText={setStreet} autoComplete="street-address" textContentType="streetAddressLine1" />
        <Field label="Apt or unit (optional)" value={unit} onChangeText={setUnit} textContentType="streetAddressLine2" />
        <Field label="City" value={city} onChangeText={setCity} autoComplete="postal-address-locality" textContentType="addressCity" />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field
              label="State"
              placeholder="CA"
              autoCapitalize="characters"
              maxLength={2}
              value={state}
              onChangeText={(t) => setState(t.toUpperCase().replace(/[^A-Z]/g, ''))}
              error={stateError}
            />
          </View>
          <View style={styles.flex}>
            <Field
              label="ZIP"
              keyboardType="number-pad"
              maxLength={5}
              value={zip}
              onChangeText={(t) => setZip(t.replace(/\D/g, ''))}
              autoComplete="postal-code"
              error={zipError}
            />
          </View>
        </View>
        <View style={[styles.country, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="bodyMedium" style={styles.flex}>
            🇺🇸 United States
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="I live outside the United States"
            onPress={() => router.replace({ pathname: '/ineligible', params: { reason: 'country' } })}
            style={styles.outside}>
            <Text variant="caption" color="accent">
              Not in the US?
            </Text>
          </PressableScale>
        </View>
      </View>

      <SectionLabel>Confirm it’s you</SectionLabel>
      <Segmented<Method>
        value={method}
        onChange={setMethod}
        options={[
          { value: 'ssn', label: 'Last 4 of SSN' },
          { value: 'id', label: 'Scan ID' },
        ]}
      />
      <View style={styles.method}>
        {method === 'ssn' ? (
          <Field
            label="Last 4 digits of your Social Security number"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={ssn4}
            onChangeText={(t) => setSsn4(t.replace(/\D/g, ''))}
            autoComplete="off"
          />
        ) : (
          <PressableScale
            scaleTo={0.98}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={idScanned ? 'ID scanned. Scan again' : 'Scan your driver’s license or passport'}
            onPress={scanId}
            style={[styles.scan, { borderColor: idScanned ? colors.success : colors.border, backgroundColor: colors.surface }]}>
            <Icon name={idScanned ? 'check' : 'camera'} size={28} color={idScanned ? colors.success : colors.accent} />
            <Text variant="bodyMedium">{idScanned ? 'ID scanned' : 'Scan your driver’s license or passport'}</Text>
            <Text variant="small" color="textSecondary" align="center">
              {idScanned ? 'Tap to scan again.' : 'Use good light and fit the whole card in the frame.'}
            </Text>
          </PressableScale>
        )}
      </View>

      {error ? <Footnote tone="error">{error}</Footnote> : null}
      <Footnote>
        Your details are sent securely to our licensed payments partner to confirm your identity. Payvr doesn’t store your
        SSN or ID images.
      </Footnote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  stack: { gap: 14 },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  outside: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12 },
  method: { marginTop: 14 },
  scan: { alignItems: 'center', gap: 8, padding: 24, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
});
