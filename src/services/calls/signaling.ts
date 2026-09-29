import type { SupabaseClient } from '@supabase/supabase-js';

import type { Signal, Signaling } from './types';

/**
 * Call setup messages over Supabase Realtime broadcast, one channel per person ("calls:<user id>").
 * The audio/video itself never goes through here.
 *
 * Before real users: make these private channels with Realtime Authorization so only the
 * owner can listen on their channel and senders can't pretend to be someone else
 * (see docs/CALLS.md).
 */
export function supabaseSignaling(client: SupabaseClient): Signaling {
  return {
    async send(signal) {
      const ch = client.channel(`calls:${signal.to}`);
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Signaling timed out')), 8000);
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(t);
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(t);
            reject(new Error(`Signaling ${status}`));
          }
        });
      });
      await ch.send({ type: 'broadcast', event: 'signal', payload: signal });
      void client.removeChannel(ch);
    },
    listen(userId, onSignal) {
      const ch = client
        .channel(`calls:${userId}`)
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          const s = payload as Signal;
          if (s && s.to === userId && typeof s.callId === 'string') onSignal(s);
        })
        .subscribe();
      return () => {
        void client.removeChannel(ch);
      };
    },
  };
}

/** In-memory signaling for tests: every listener on the same bus hears signals sent to them. */
export function memorySignaling(): Signaling {
  const listeners = new Map<string, Set<(s: Signal) => void>>();
  return {
    async send(signal) {
      // Deliver asynchronously, like a network.
      setTimeout(() => listeners.get(signal.to)?.forEach((fn) => fn(signal)), 0);
    },
    listen(userId, onSignal) {
      const set = listeners.get(userId) ?? new Set();
      set.add(onSignal);
      listeners.set(userId, set);
      return () => set.delete(onSignal);
    },
  };
}
