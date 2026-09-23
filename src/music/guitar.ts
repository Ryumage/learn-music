import { pitchClassLabel, type Lang } from './names';
import { mod } from './notes';

export type StringNo = 1 | 2 | 3 | 4 | 5 | 6;
export const STRINGS: readonly StringNo[] = [6, 5, 4, 3, 2, 1];

/** Leersaiten, klingend (MIDI). */
export const OPEN_MIDI: Record<StringNo, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };

/** Kurzname wie in den Cheat Sheets (tief → hoch: E A D G H e). */
export function stringLetter(s: StringNo, lang: Lang): string {
  const de: Record<StringNo, string> = { 6: 'E', 5: 'A', 4: 'D', 3: 'G', 2: 'H', 1: 'e' };
  return lang === 'en' && s === 2 ? 'B' : de[s];
}

/** „tiefe E-Saite“, „A-Saite“, „H-Saite“ (EN: „B-Saite“), „hohe E-Saite“. */
export function stringName(s: StringNo, lang: Lang): string {
  if (s === 6) return 'tiefe E-Saite';
  if (s === 1) return 'hohe E-Saite';
  return `${stringLetter(s, lang)}-Saite`;
}

/** Tonklasse der Leersaite. */
export function openPitchClass(s: StringNo): number {
  return mod(OPEN_MIDI[s], 12);
}

export function fretMidi(s: StringNo, fret: number): number {
  return OPEN_MIDI[s] + fret;
}

export interface Position {
  string: StringNo;
  fret: number;
}

/** Alle Stellen mit exakt dieser klingenden Tonhöhe bis maxFret. */
export function positionsOf(sounding: number, maxFret = 12, minFret = 0): Position[] {
  const out: Position[] = [];
  for (const s of STRINGS) {
    const f = sounding - OPEN_MIDI[s];
    if (f >= minFret && f <= maxFret) out.push({ string: s, fret: f });
  }
  return out;
}

/** Stelle in der 1. Lage (Bund 0–4): die mit dem kleinsten Bund, sonst null. */
export function firstPosition(sounding: number): Position | null {
  const candidates = positionsOf(sounding, 4).sort((a, b) => a.fret - b.fret);
  return candidates[0] ?? null;
}

export function positionText(p: Position, lang: Lang): string {
  const name = stringName(p.string, lang);
  return p.fret === 0 ? `${name} leer` : `${name}, ${p.fret}. Bund`;
}

/**
 * Herleitung am Griffbrett (PLAN 4.5): „A-Saite, 3. Bund: A → Ais/B → H → C“.
 * Ab dem 12. Bund wird von der Oktave der Leersaite weitergezählt.
 */
export function fretDerivation(p: Position, lang: Lang): string {
  const open = openPitchClass(p.string);
  const head = positionText(p, lang);
  const start = p.fret >= 12 ? 12 : 0;
  const chain: string[] = [];
  for (let f = start; f <= p.fret; f++) chain.push(pitchClassLabel(open + f, lang));
  const prefix = start === 12 ? '12. Bund = Oktave der Leersaite: ' : '';
  return `${head}: ${prefix}${chain.join(' → ')}`;
}

/**
 * Greifbarkeit eines Mehrklangs (PLAN M2): jeder Ton auf einer eigenen Saite,
 * alle Bünde im erlaubten Bereich, gegriffene Bünde höchstens maxSpan auseinander.
 * Liefert eine Zuordnung (Backtracking) oder null.
 */
export function playable(sounding: readonly number[], maxFret: number, maxSpan = 3, minFret = 0): Position[] | null {
  const notes = [...sounding].sort((a, b) => a - b);
  const used = new Set<StringNo>();
  const chosen: Position[] = [];

  const spanOk = () => {
    const fretted = chosen.map((p) => p.fret).filter((f) => f > 0);
    return fretted.length === 0 || Math.max(...fretted) - Math.min(...fretted) <= maxSpan;
  };

  const place = (i: number): boolean => {
    if (i === notes.length) return true;
    for (const s of STRINGS) {
      if (used.has(s)) continue;
      const fret = notes[i]! - OPEN_MIDI[s];
      if (fret < minFret || fret > maxFret) continue;
      used.add(s);
      chosen.push({ string: s, fret });
      if (spanOk() && place(i + 1)) return true;
      chosen.pop();
      used.delete(s);
    }
    return false;
  };

  return place(0) ? [...chosen] : null;
}

/** Bequemste Stelle für einen Einzelton: kleinster Bund bis maxFret. */
export function easiestPosition(sounding: number, maxFret = 12): Position | null {
  return positionsOf(sounding, maxFret).sort((a, b) => a.fret - b.fret)[0] ?? null;
}
