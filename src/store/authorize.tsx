import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { PinPad } from '@/components/pin-pad';
import { authenticateBiometric } from '@/services/biometrics';
import { storage, StorageKeys } from '@/services/storage';
import { useTheme } from '@/theme/theme-provider';

import { useApp } from './app-store';

/** Prototype default when no PIN was created during sign-up. */
export const DEMO_PIN = '1234';

type Ctx = { authorize: (reason: string) => Promise<boolean> };
const AuthorizeContext = createContext<Ctx | null>(null);

/**
 * Every payment goes through `authorize()`:
 * Face ID / fingerprint first (when enabled and available), otherwise the Payvr PIN.
 */
export function AuthorizeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState<{ reason: string; pin: string } | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const authorize = useCallback(
    async (reason: string) => {
      if (settings.biometricsOn && (await authenticateBiometric(reason))) return true;
      const pin = (await storage.get(StorageKeys.pin)) ?? DEMO_PIN;
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setPrompt({ reason, pin });
      });
    },
    [settings.biometricsOn],
  );

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPrompt(null);
  };

  return (
    <AuthorizeContext.Provider value={{ authorize }}>
      {children}
      <Modal visible={!!prompt} animationType="slide" onRequestClose={() => finish(false)}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
          ]}>
          <IconButton icon="close" label="Cancel" onPress={() => finish(false)} />
          {prompt ? (
            <PinPad
              title="Enter your PIN"
              subtitle={
                prompt.pin === DEMO_PIN ? `${prompt.reason}\nPrototype PIN: ${DEMO_PIN}` : prompt.reason
              }
              onComplete={(p) => {
                if (p !== prompt.pin) return false;
                finish(true);
              }}
            />
          ) : null}
        </View>
      </Modal>
    </AuthorizeContext.Provider>
  );
}

export function useAuthorize() {
  const ctx = useContext(AuthorizeContext);
  if (!ctx) throw new Error('useAuthorize must be used inside AuthorizeProvider');
  return ctx.authorize;
}

const styles = StyleSheet.create({ sheet: { flex: 1, paddingHorizontal: 24 } });
