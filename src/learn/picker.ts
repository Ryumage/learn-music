import { isDue, type ItemStat } from './leitner';

/** Gewicht eines Elements für die Auswahl (PLAN 5.4). */
export function weight(stat: ItemStat | undefined, now: number, recent: boolean): number {
  let w: number;
  if (!stat) {
    w = 1.3;
  } else {
    w = isDue(stat, now) ? 3 : 0.5;
    w += (3 * (stat.w + 0.5)) / (stat.n + 1);
    if (stat.t > 7000) w += 0.6;
  }
  return recent ? w * 0.03 : w;
}

/** Gewichteter Zufall; die letzten 2 Elemente werden stark abgewertet. */
export function pickWeighted(
  keys: readonly string[],
  stats: Record<string, ItemStat>,
  now: number,
  recent: readonly string[],
  rng: () => number = Math.random,
): string {
  if (keys.length === 0) throw new Error('Keine Elemente zur Auswahl');
  const last2 = recent.slice(-2);
  const weights = keys.map((k) => weight(stats[k], now, last2.includes(k)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= weights[i]!;
    if (r < 0) return keys[i]!;
  }
  return keys[keys.length - 1]!;
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
