import { noteName, type Lang } from './names';
import { LETTERS, LETTER_STEPS, mod, pitchClass, type Spelling } from './notes';
import { OPEN_MIDI, type StringNo } from './guitar';

export type ChordSuffix =
  | ''
  | 'm'
  | '7'
  | 'm7'
  | 'maj7'
  | '6'
  | 'm6'
  | '9'
  | 'sus2'
  | 'sus4'
  | '7sus4'
  | 'add9'
  | 'dim'
  | 'dim7'
  | 'aug'
  | 'm7b5'
  | '5';
export const SUFFIXES: readonly ChordSuffix[] = ['', 'm', '7', 'm7', 'maj7', '6', 'm6', '9', 'sus2', 'sus4', '7sus4', 'add9', 'dim', 'dim7', 'aug', 'm7b5', '5'];

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
  '6': [[0, 1], [4, 3], [7, 5], [9, 6]],
  m6: [[0, 1], [3, 3], [7, 5], [9, 6]],
  '9': [[0, 1], [4, 3], [7, 5], [10, 7], [14, 9]],
  '7sus4': [[0, 1], [5, 4], [7, 5], [10, 7]],
  dim: [[0, 1], [3, 3], [6, 5]],
  dim7: [[0, 1], [3, 3], [6, 5], [9, 7]],
  aug: [[0, 1], [4, 3], [8, 5]],
  m7b5: [[0, 1], [3, 3], [6, 5], [10, 7]],
};

/** Akkorde mit vier oder mehr Tönen: die (reine) Quinte darf im Griff fehlen. */
const FIFTH_OPTIONAL: ReadonlySet<ChordSuffix> = new Set(['7', 'm7', 'maj7', '6', 'm6', '9', '7sus4']);

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
    '6': 'Sextakkord: Dur-Dreiklang plus große Sexte',
    m6: 'Moll-Sextakkord: Moll-Dreiklang plus große Sexte',
    '9': 'Nonenakkord: Dominantseptakkord plus None',
    '7sus4': '7sus4: sus4-Akkord plus kleine Septime',
    dim: 'Verminderter Dreiklang: Grundton, kleine Terz, verminderte Quinte',
    dim7: 'Verminderter Septakkord: verminderter Dreiklang plus verminderte Septime',
    aug: 'Übermäßiger Dreiklang: Grundton, große Terz, übermäßige Quinte',
    m7b5: 'Halbverminderter Septakkord: verminderter Dreiklang plus kleine Septime',
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

/** Liest „x32010“ oder – ab Bund 10 – mit Bindestrichen „x-10-12-12-12-10“. */
export function parseShape(text: string): Shape {
  const parts = text.includes('-') ? text.split('-') : [...text];
  return parts.map((ch) => (ch === 'x' ? null : Number(ch)));
}

/** Gegenstück zu parseShape: kurz, solange alle Bünde einstellig sind. */
export function shapeText(shape: Shape): string {
  const parts = shape.map((f) => (f === null ? 'x' : String(f)));
  return parts.every((p) => p.length === 1) ? parts.join('') : parts.join('-');
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
 * Bei Akkorden mit vier oder mehr Tönen (Sept-, Sext-, Nonenakkorde) darf die reine Quinte fehlen.
 */
export function checkShape(shape: Shape, c: ChordSymbol): ShapeCheck {
  const played = shapePitchClasses(shape);
  const rootPc = pitchClass(c.root);
  const fifth = mod(rootPc + 7, 12);
  const wanted = chordPitchClasses(c);
  const missing = wanted.filter((pc) => !played.includes(pc) && !(FIFTH_OPTIONAL.has(c.suffix) && pc === fifth));
  const foreign = played.filter((pc) => !wanted.includes(pc));
  const bass = shapeMidi(shape)[0];
  const inversion = bass !== undefined && mod(bass, 12) !== rootPc;
  return { ok: missing.length === 0 && foreign.length === 0, missing, foreign, inversion };
}

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
