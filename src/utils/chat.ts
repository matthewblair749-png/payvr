import type { ChatMessage } from '@/data/chat';

import { formatShort } from './money';

/** One line of preview for the chat list. */
export function previewText(m: ChatMessage | undefined, meId: string, nameOf: (id: string) => string) {
  if (!m) return 'No messages yet';
  const who = m.userId === meId ? 'You' : nameOf(m.userId);
  switch (m.kind) {
    case 'text':
      return `${who}: ${m.text}`;
    case 'split':
      return `${who} split ${m.split.note} · ${formatShort(m.split.totalCents)}`;
    case 'payment':
      return `${who} paid ${m.toUser === meId ? 'you' : nameOf(m.toUser)} · ${m.note}`;
    case 'system':
      return m.text;
  }
}
