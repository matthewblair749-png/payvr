import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { PinPad } from '@/components/pin-pad';
import { Screen } from '@/components/screen';
import { storage, StorageKeys } from '@/services/storage';

export default function PinSetup() {
  const [first, setFirst] = useState<string | null>(null);

  const onComplete = useCallback(
    (pin: string) => {
      if (!first) {
        setFirst(pin);
        return;
      }
      if (pin !== first) {
        setFirst(null);
        return false;
      }
      storage.set(StorageKeys.pin, pin).then(() => router.push('/welcome'));
    },
    [first],
  );

  return (
    <Screen back="back">
      <PinPad
        key={first ? 'confirm' : 'create'}
        title={first ? 'Confirm your PIN' : 'Create a PIN'}
        subtitle={first ? 'Enter it once more.' : 'A 4-digit backup for when Face ID can’t be used.'}
        onComplete={onComplete}
      />
    </Screen>
  );
}
