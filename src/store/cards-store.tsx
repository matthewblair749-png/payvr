import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { cardLabel, TEST_CARDS, type LinkedCard } from '@/data/cards';
import { storage } from '@/services/storage';

import { useApp } from './app-store';

/** What pays for a tap payment: your Payvr balance, or a linked card (charged first, then sent). */
export type FundingSource = 'balance' | string;

type CardsState = {
  cards: LinkedCard[];
  cardById: (id: string) => LinkedCard | undefined;
  addCard: (card: Omit<LinkedCard, 'id' | 'addedAt'>) => LinkedCard;
  removeCard: (id: string) => void;
  /** Default for new payments. */
  defaultSource: FundingSource;
  setDefaultSource: (s: FundingSource) => void;
  sourceLabel: (s: FundingSource) => string;
  /** Which source paid for a transaction (shown on the receipt). */
  paidWith: Record<string, string>;
  notePaidWith: (txId: string, label: string) => void;
};

const Ctx = createContext<CardsState | null>(null);
const KEYS = { cards: 'payvr.cards', source: 'payvr.defaultSource' };

/** Keeps only the display fields, so nothing sensitive can end up in storage. */
function sanitize(list: unknown): LinkedCard[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((c) => c && typeof c.id === 'string' && /^\d{4}$/.test(c.last4))
    .map((c) => ({
      id: c.id,
      brand: c.brand,
      last4: c.last4,
      expMonth: Number(c.expMonth),
      expYear: Number(c.expYear),
      issuer: String(c.issuer ?? ''),
      addedAt: String(c.addedAt ?? ''),
    }));
}

export function CardsProvider({ children }: { children: React.ReactNode }) {
  const { backendMode } = useApp();
  const [cards, setCards] = useState<LinkedCard[]>(() =>
    backendMode === 'mock' ? [{ ...TEST_CARDS[0], id: 'card_seed_visa', addedAt: new Date(Date.now() - 86_400_000 * 20).toISOString() }] : [],
  );
  const [defaultSource, setDefault] = useState<FundingSource>('balance');
  const [paidWith, setPaidWith] = useState<Record<string, string>>({});

  useEffect(() => {
    storage.get(KEYS.cards).then((v) => {
      if (!v) return;
      try {
        setCards(sanitize(JSON.parse(v)));
      } catch {
        // ignore a corrupt value
      }
    });
    storage.get(KEYS.source).then((v) => v && setDefault(v));
  }, []);

  const save = (list: LinkedCard[]) => storage.set(KEYS.cards, JSON.stringify(sanitize(list)));

  const cardById = useCallback((id: string) => cards.find((c) => c.id === id), [cards]);

  const addCard = useCallback((card: Omit<LinkedCard, 'id' | 'addedAt'>) => {
    const added: LinkedCard = { ...card, id: `card_${Date.now().toString(36)}`, addedAt: new Date().toISOString() };
    setCards((list) => {
      const next = [...list.filter((c) => !(c.brand === card.brand && c.last4 === card.last4)), added];
      save(next);
      return next;
    });
    return added;
  }, []);

  const setDefaultSource = useCallback((s: FundingSource) => {
    setDefault(s);
    storage.set(KEYS.source, s);
  }, []);

  const removeCard = useCallback(
    (id: string) => {
      setCards((list) => {
        const next = list.filter((c) => c.id !== id);
        save(next);
        return next;
      });
      if (defaultSource === id) setDefaultSource('balance');
    },
    [defaultSource, setDefaultSource],
  );

  const sourceLabel = useCallback(
    (s: FundingSource) => {
      if (s === 'balance') return 'Payvr balance';
      const c = cards.find((x) => x.id === s);
      return c ? cardLabel(c) : 'Payvr balance';
    },
    [cards],
  );

  const notePaidWith = useCallback((txId: string, label: string) => setPaidWith((m) => ({ ...m, [txId]: label })), []);

  // A removed default card falls back to the balance.
  const effectiveDefault = defaultSource === 'balance' || cards.some((c) => c.id === defaultSource) ? defaultSource : 'balance';

  const value: CardsState = {
    cards,
    cardById,
    addCard,
    removeCard,
    defaultSource: effectiveDefault,
    setDefaultSource,
    sourceLabel,
    paidWith,
    notePaidWith,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCards() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCards must be used inside CardsProvider');
  return ctx;
}
