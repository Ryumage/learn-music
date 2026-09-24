import type { ItemStat } from './leitner';

export interface Tally {
  n: number;
  c: number;
}

/**
 * Trefferquote je Griffbrett-Stelle (Saite 1–6, Bund 0–12) aus M4 („fret:s:f“, „find:s:f“).
 * Schlüssel „s:f“.
 */
export function heatmapData(items: Record<string, ItemStat>, maxFret = 12): Map<string, Tally> {
  const out = new Map<string, Tally>();
  for (const [key, st] of Object.entries(items)) {
    const m = /^(?:fret|find):([1-6]):(\d+)$/.exec(key);
    if (!m || Number(m[2]) > maxFret) continue;
    const k = `${m[1]}:${m[2]}`;
    const t = out.get(k) ?? { n: 0, c: 0 };
    t.n += st.n;
    t.c += st.c;
    out.set(k, t);
  }
  return out;
}

export interface Weakness {
  key: string;
  n: number;
  c: number;
  /** Fehlerquote 0–1 */
  errorRate: number;
}

/** Schwächste Elemente: nur solche mit Fehlern, höchste Fehlerquote zuerst, bei Gleichstand mehr Antworten zuerst. */
export function weakest(items: Record<string, ItemStat>, prefixes: readonly string[] | null, limit = 10): Weakness[] {
  return Object.entries(items)
    .filter(([k, s]) => s.w > 0 && (!prefixes || prefixes.some((p) => k.startsWith(p))))
    .map(([key, s]) => ({ key, n: s.n, c: s.c, errorRate: s.w / s.n }))
    .sort((a, b) => b.errorRate - a.errorRate || b.n - a.n || a.key.localeCompare(b.key))
    .slice(0, limit);
}
