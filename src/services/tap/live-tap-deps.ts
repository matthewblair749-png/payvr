/** Wires live tapping to the real radios (native module + ble-plx) and Supabase. */
import { backend } from '@/services/backend';

import type { TapDeps } from './live-tap';
import { nearbyNative, prepareRadio, scanForTokens } from './radio';

export const liveTapDeps: TapDeps = {
  prepareRadio,
  scanForTokens,
  nearby: nearbyNative,
  backend: {
    startTapSession: (input) => backend.startTapSession(input),
    resolveTapToken: (token) => backend.resolveTapToken(token),
    endTapSession: () => backend.endTapSession(),
  },
};
