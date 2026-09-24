import { noteName, type Lang } from './names';
import { LETTERS, LETTER_STEPS, mod, pitchClass, type Spelling } from './notes';
import { OPEN_MIDI, type StringNo } from './guitar';

export type ChordSuffix = '' | 'm' | '7' | 'm7' | 'maj7' | 'sus2' | 'sus4' | 'add9' | '5';
export const SUFFIXES: readonly ChordSuffix[] = ['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', 'add9', '5'];

/** Akkordformeln: [Halbtöne über dem Grundton, Stufe] (PLAN 4.6). */
export const FORMULAS: Record<ChordSuffix, readonly (readonly [number, number])[]> = {
  '': [[0, 1], [4, 3], [7, 5]],
  m: [[0, 1], [3, 3], [7, 5]],
  '7': [[0, 1], [4, 3], [7, 5], [10, 7]],
  m7: [[0, 1], [3, 3], [7, 5], [10, 7]],
  maj7: [[0, 1], [4, 3], [7, 5], [11, 7]],
  sus2: [[0, 1], [2, 2], [7, 5]],
  sus4: [[0, 1], [5, 4], [7, 5]],
  add9: [[0, 1], [4, 3], [7, 5], [14, 9]],
  '5': [[0, 1], [7, 5]],
};

const SEVENTHS: ReadonlySet<ChordSuffix> = new Set(['7', 'm7', 'maj7']);

export function formulaText(suffix: ChordSuffix): string {
  return {
    '': 'Dur-Dreiklang: Grundton, große Terz, Quinte',
    m: 'Moll-Dreiklang: Grundton, kleine Terz, Quinte',
    '7': 'Dominantseptakkord: Dur-Dreiklang plus kleine Septime',
    m7: 'Moll-Septakkord: Moll-Dreiklang plus kleine Septime',
    maj7: 'Major-Septakkord: Dur-Dreiklang plus große Septime',
    sus2: 'sus2: Grundton, große Sekunde, Quinte (keine Terz)',
    sus4: 'sus4: Grundton, Quarte, Quinte (keine Terz)',
    add9: 'add9: Dur-Dreiklang plus None',
    '5': 'Powerchord: Grundton und Quinte',
  }[suffix];
}

export interface ChordSymbol {
  root: Spelling;
  suffix: ChordSuffix;
}

/** Liest Symbole wie „F#m“, „Bb“, „Cmaj7“ (ASCII # und b, wie auf Ultimate Guitar). */
export function parseChord(symbol: string): ChordSymbol {
  const m = /^([A-G])(#|b)?(.*)$/.exec(symbol);
  if (!m || !(SUFFIXES as readonly string[]).includes(m[3]!)) throw new Error(`Unbekannter Akkord: ${symbol}`);
  return {
    root: { letter: LETTERS.indexOf(m[1]!), acc: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0 },
    suffix: m[3] as ChordSuffix,
  };
}

export function chordSymbol(c: ChordSymbol): string {
  const acc = c.root.acc === 1 ? '#' : c.root.acc === -1 ? 'b' : '';
  return LETTERS[c.root.letter] + acc + c.suffix;
}

/** Akkordtöne mit richtiger Schreibweise (Terz über Terz), z. B. B7 → B D# F# A. */
export function chordTones(c: ChordSymbol): Spelling[] {
  const rootPc = pitchClass(c.root);
  return FORMULAS[c.suffix].map(([semis, degree]) => {
    const letter = mod(c.root.letter + degree - 1, 7);
    const acc = mod(rootPc + semis - LETTER_STEPS[letter]! + 6, 12) - 6;
    return { letter, acc };
  });
}

export function chordPitchClasses(c: ChordSymbol): number[] {
  return FORMULAS[c.suffix].map(([semis]) => mod(pitchClass(c.root) + semis, 12));
}

/** Deutsche Aussprache: G-Dur, h-Moll, H7, fis-Moll, B-Dur. */
export function chordSpoken(c: ChordSymbol, lang: Lang): string {
  const root = noteName(c.root, lang);
  if (c.suffix === '') return `${root}-Dur`;
  if (c.suffix === 'm') return `${root.toLowerCase()}-Moll`;
  return root + c.suffix;
}

/** Griff wie „x32010“: von der tiefen E- zur hohen E-Saite, null = nicht gespielt. */
export type Shape = (number | null)[];

export function parseShape(text: string): Shape {
  return [...text].map((ch) => (ch === 'x' ? null : Number(ch)));
}

/** Saitennummer zur Position im Griff (Index 0 = 6. Saite). */
export function shapeString(index: number): StringNo {
  return (6 - index) as StringNo;
}

export function shapeMidi(shape: Shape): number[] {
  const out: number[] = [];
  shape.forEach((fret, i) => {
    if (fret !== null) out.push(OPEN_MIDI[shapeString(i)] + fret);
  });
  return out;
}

export function shapePitchClasses(shape: Shape): number[] {
  return [...new Set(shapeMidi(shape).map((m) => mod(m, 12)))];
}

export interface ShapeCheck {
  ok: boolean;
  missing: number[];
  foreign: number[];
  /** Basston ist nicht der Grundton. */
  inversion: boolean;
}

/**
 * Prüft einen Griff über Tonklassen: alle Akkordtöne vorhanden, keine fremden.
 * Bei Septakkorden darf die Quinte fehlen.
 */
export function checkShape(shape: Shape, c: ChordSymbol): ShapeCheck {
  const played = shapePitchClasses(shape);
  const rootPc = pitchClass(c.root);
  const fifth = mod(rootPc + 7, 12);
  const wanted = chordPitchClasses(c);
  const missing = wanted.filter((pc) => !played.includes(pc) && !(SEVENTHS.has(c.suffix) && pc === fifth));
  const foreign = played.filter((pc) => !wanted.includes(pc));
  const bass = shapeMidi(shape)[0];
  const inversion = bass !== undefined && mod(bass, 12) !== rootPc;
  return { ok: missing.length === 0 && foreign.length === 0, missing, foreign, inversion };
}

export type ChordSet = 'basic' | 'plus' | 'seven' | 'barre';

export interface ChordDef {
  id: string;
  set: ChordSet;
  symbol: string;
  /** Anzeigename, wenn es mehrere Griffe gibt: „F (klein)“, „F (Barré)“. */
  label: string;
  shape: string;
  fingers: string | null;
}

/** Geprüfte Griffe (PLAN 4.6). */
export const CHORDS: readonly ChordDef[] = [
  { id: 'A', set: 'basic', symbol: 'A', label: 'A', shape: 'x02220', fingers: 'x01230' },
  { id: 'D', set: 'basic', symbol: 'D', label: 'D', shape: 'xx0232', fingers: 'xx0132' },
  { id: 'E', set: 'basic', symbol: 'E', label: 'E', shape: '022100', fingers: '023100' },
  { id: 'Am', set: 'basic', symbol: 'Am', label: 'Am', shape: 'x02210', fingers: 'x02310' },
  { id: 'Em', set: 'basic', symbol: 'Em', label: 'Em', shape: '022000', fingers: '023000' },
  { id: 'Dm', set: 'basic', symbol: 'Dm', label: 'Dm', shape: 'xx0231', fingers: 'xx0231' },
  { id: 'G', set: 'basic', symbol: 'G', label: 'G', shape: '320003', fingers: '210003' },
  { id: 'C', set: 'basic', symbol: 'C', label: 'C', shape: 'x32010', fingers: 'x32010' },
  { id: 'Fs', set: 'plus', symbol: 'F', label: 'F (klein)', shape: 'xx3211', fingers: 'xx3211' },
  { id: 'Fmaj7', set: 'plus', symbol: 'Fmaj7', label: 'Fmaj7', shape: 'xx3210', fingers: 'xx3210' },
  { id: 'Cadd9', set: 'plus', symbol: 'Cadd9', label: 'Cadd9', shape: 'x32030', fingers: null },
  { id: 'Dsus4', set: 'plus', symbol: 'Dsus4', label: 'Dsus4', shape: 'xx0233', fingers: 'xx0134' },
  { id: 'Dsus2', set: 'plus', symbol: 'Dsus2', label: 'Dsus2', shape: 'xx0230', fingers: 'xx0130' },
  { id: 'Asus2', set: 'plus', symbol: 'Asus2', label: 'Asus2', shape: 'x02200', fingers: 'x01200' },
  { id: 'Asus4', set: 'plus', symbol: 'Asus4', label: 'Asus4', shape: 'x02230', fingers: null },
  { id: 'Em7', set: 'plus', symbol: 'Em7', label: 'Em7', shape: '022030', fingers: null },
  { id: 'Am7', set: 'plus', symbol: 'Am7', label: 'Am7', shape: 'x02010', fingers: 'x02010' },
  { id: 'Cmaj7', set: 'plus', symbol: 'Cmaj7', label: 'Cmaj7', shape: 'x32000', fingers: 'x32000' },
  { id: 'E7', set: 'seven', symbol: 'E7', label: 'E7', shape: '020100', fingers: '020100' },
  { id: 'A7', set: 'seven', symbol: 'A7', label: 'A7', shape: 'x02020', fingers: 'x02030' },
  { id: 'D7', set: 'seven', symbol: 'D7', label: 'D7', shape: 'xx0212', fingers: 'xx0213' },
  { id: 'G7', set: 'seven', symbol: 'G7', label: 'G7', shape: '320001', fingers: '320001' },
  { id: 'C7', set: 'seven', symbol: 'C7', label: 'C7', shape: 'x32310', fingers: 'x32410' },
  { id: 'B7', set: 'seven', symbol: 'B7', label: 'B7', shape: 'x21202', fingers: 'x21304' },
  { id: 'Fb', set: 'barre', symbol: 'F', label: 'F (Barré)', shape: '133211', fingers: '134211' },
  { id: 'Bm', set: 'barre', symbol: 'Bm', label: 'Bm', shape: 'x24432', fingers: 'x13421' },
  { id: 'E5', set: 'barre', symbol: 'E5', label: 'E5', shape: '022xxx', fingers: '013xxx' },
  { id: 'A5', set: 'barre', symbol: 'A5', label: 'A5', shape: 'x022xx', fingers: 'x013xx' },
];

/** Tonnamen, wie Ultimate Guitar sie für Akkorde schreibt. */
export const UG_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Kapodaster im Bund k hebt alles um k Halbtöne: klingender Akkord. */
export function capoSounding(shapeSymbol: string, capo: number): string {
  const c = parseChord(shapeSymbol);
  return UG_ROOTS[mod(pitchClass(c.root) + capo, 12)] + c.suffix;
}

/** Halbtonkette „G → Ab → A“ für die Lösung. */
export function capoChain(shapeSymbol: string, capo: number): string {
  const c = parseChord(shapeSymbol);
  const root = pitchClass(c.root);
  const chain: string[] = [];
  for (let k = 0; k <= capo; k++) chain.push(UG_ROOTS[mod(root + k, 12)] + c.suffix);
  return chain.join(' → ');
}

/** „Welcher Bund?“ = (Ziel − Griff) mod 12. */
export function capoFret(targetSymbol: string, shapeSymbol: string): number {
  return mod(pitchClass(parseChord(targetSymbol).root) - pitchClass(parseChord(shapeSymbol).root), 12);
}
