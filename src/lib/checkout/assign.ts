/**
 * Deterministic A/B assignment: the same visitor always lands in the same
 * variant for a given experiment, with no database write on page view.
 */

/** 32-bit FNV-1a hash — fast, well-distributed, dependency-free. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function assignVariant<T extends { key: string; weight: number }>(
  visitorId: string,
  experimentId: string,
  variants: T[],
): T | null {
  const pool = variants.filter((v) => v.weight > 0).sort((a, b) => a.key.localeCompare(b.key));
  const total = pool.reduce((s, v) => s + v.weight, 0);
  if (!pool.length || total <= 0) return null;
  let bucket = fnv1a(`${experimentId}:${visitorId}`) % total;
  for (const v of pool) {
    if (bucket < v.weight) return v;
    bucket -= v.weight;
  }
  return pool[pool.length - 1];
}
