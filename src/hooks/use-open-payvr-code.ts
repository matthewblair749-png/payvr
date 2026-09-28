import { router } from 'expo-router';
import { useCallback } from 'react';

import type { ParseResult } from '@/services/qr';
import { useApp } from '@/store/app-store';
import { haptics } from '@/utils/haptics';

/**
 * Acts on a scanned (or deep-linked) Payvr code:
 *  - request code  → Confirm "Pay $20 to Jake?"
 *  - "My code" while a payment is being set up → Confirm with that person
 *  - "My code" otherwise → Amount screen for that person
 * Resolves to an error message to show, or null when it navigated.
 */
export function useOpenPayvrCode() {
  const { lookupHandle, draft, setDraft, me } = useApp();

  return useCallback(
    async (parsed: ParseResult): Promise<string | null> => {
      if (!parsed.ok) {
        return parsed.reason === 'expired'
          ? 'That code has expired. Ask them to show it again.'
          : 'That’s not a Payvr code.';
      }
      const { code } = parsed;
      const user = await lookupHandle(code.handle).catch(() => null);
      if (!user) return 'We couldn’t find that person.';
      if (user.id === me.id) return 'That’s your own code.';

      haptics.success();
      if (code.request) {
        setDraft({
          mode: 'send',
          amountCents: code.request.amountCents,
          note: code.request.note,
          peerId: user.id,
          origin: 'qrRequest',
          ref: code.request.ref,
        });
        router.replace('/confirm');
      } else if (draft) {
        setDraft({ ...draft, peerId: user.id });
        router.replace('/confirm');
      } else {
        router.replace({ pathname: '/amount', params: { to: user.id } });
      }
      return null;
    },
    [lookupHandle, draft, setDraft, me.id],
  );
}
