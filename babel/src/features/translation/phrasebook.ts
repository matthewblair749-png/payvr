import type { LanguageCode } from "./languages";

/**
 * Hand-checked translations used by the live demo before (or without) a real
 * translation provider. Everything here is shown to visitors labelled as a
 * preview, so every line must be a correct, natural translation.
 *
 * Source sentences are English. Keep them short and everyday.
 */
export interface PhrasebookEntry {
  id: string;
  /** Short label for the "try one of these" suggestions. */
  label: string;
  source: string;
  translations: Record<Exclude<LanguageCode, "en">, string>;
}

export const PHRASEBOOK: PhrasebookEntry[] = [
  {
    id: "dinner",
    label: "Dinner plans",
    source: "Hey! Want to grab dinner on Friday? I know a little place by the river.",
    translations: {
      es: "¡Hola! ¿Quieres ir a cenar el viernes? Conozco un sitio pequeño junto al río.",
      fr: "Salut ! Ça te dit d'aller dîner vendredi ? Je connais un petit endroit au bord de la rivière.",
      de: "Hey! Hast du Lust, am Freitag essen zu gehen? Ich kenne ein kleines Lokal am Fluss.",
      it: "Ehi! Ti va di andare a cena venerdì? Conosco un posticino vicino al fiume.",
      pt: "Oi! Quer jantar fora na sexta? Conheço um lugarzinho perto do rio.",
      ja: "ねえ、金曜日に夕飯を食べに行かない？川のそばにある小さなお店を知ってるんだ。",
      ko: "안녕! 금요일에 저녁 먹으러 갈래? 강가에 있는 작은 식당을 하나 알고 있어.",
      zh: "嘿！周五要不要一起去吃晚饭？我知道河边有一家小店。",
      ar: "مرحبًا! هل تريد أن نذهب لتناول العشاء يوم الجمعة؟ أعرف مكانًا صغيرًا بجانب النهر.",
    },
  },
  {
    id: "late",
    label: "Running late",
    source: "Sorry I'm late, the train was stuck for twenty minutes.",
    translations: {
      es: "Perdón por llegar tarde, el tren se quedó parado veinte minutos.",
      fr: "Désolé pour le retard, le train est resté bloqué vingt minutes.",
      de: "Entschuldige die Verspätung, der Zug stand zwanzig Minuten lang still.",
      it: "Scusa il ritardo, il treno è rimasto fermo per venti minuti.",
      pt: "Desculpa o atraso, o trem ficou parado por vinte minutos.",
      ja: "遅れてごめん、電車が20分止まってたんだ。",
      ko: "늦어서 미안해, 기차가 20분 동안 멈춰 있었어.",
      zh: "抱歉我迟到了，火车停了二十分钟。",
      ar: "آسف على التأخير، توقف القطار لمدة عشرين دقيقة.",
    },
  },
  {
    id: "soup",
    label: "Grandma's soup",
    source: "This soup tastes just like my grandmother's.",
    translations: {
      es: "Esta sopa sabe igual que la de mi abuela.",
      fr: "Cette soupe a exactement le même goût que celle de ma grand-mère.",
      de: "Diese Suppe schmeckt genau wie die meiner Großmutter.",
      it: "Questa zuppa ha lo stesso sapore di quella di mia nonna.",
      pt: "Essa sopa tem o mesmo gosto da sopa da minha avó.",
      ja: "このスープ、おばあちゃんの味とそっくり。",
      ko: "이 수프는 우리 할머니 수프랑 맛이 똑같아.",
      zh: "这汤的味道跟我奶奶做的一模一样。",
      ar: "طعم هذا الحساء يشبه تمامًا حساء جدتي.",
    },
  },
];

export const DEFAULT_PHRASE = PHRASEBOOK[0];

/** Whitespace-insensitive comparison so a stray space doesn't miss a match. */
export function normalizeForLookup(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * Look up a phrase in the phrasebook. Matches English source sentences and
 * any of their translations, so "translate the Spanish back to English" works.
 */
export function lookupPhrase(text: string, to: LanguageCode): { text: string; from: LanguageCode } | null {
  const needle = normalizeForLookup(text);
  for (const entry of PHRASEBOOK) {
    const versions: [LanguageCode, string][] = [
      ["en", entry.source],
      ...(Object.entries(entry.translations) as [LanguageCode, string][]),
    ];
    const match = versions.find(([, value]) => normalizeForLookup(value) === needle);
    if (!match) continue;
    const target = to === "en" ? entry.source : entry.translations[to];
    return { text: target, from: match[0] };
  }
  return null;
}
