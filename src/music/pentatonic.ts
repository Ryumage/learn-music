/**
 * Pentatonik (Issue #14): Moll- und Dur-Pentatonik in allen 12 Tonarten, je fünf Patterns
 * mit zwei Tönen pro Saite („Boxen“), die zusammen den ganzen Hals abdecken.
 *
 * Die Dur-Pentatonik nutzt dieselben Patterns wie ihre parallele Moll-Pentatonik
 * (C-Dur = a-Moll); Pattern 1 ist die Box mit dem Moll-Grundton auf der tiefen E-Saite.
 */
import { UG_ROOTS, parseChord } from './chords';
import { fretMidi, openPitchClass, type Position, type StringNo } from './guitar';
import { noteName, type Lang } from './names';
import { mod } from './notes';

export type PentaType = 'minor' | 'major';

/** Halbtöne über dem Grundton */
export const PENTA_STEPS: Record<PentaType, readonly number[]> = {
  minor: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 7, 9],
};

/** Stufen-Beschriftung je Halbton */
export const DEGREE_LABELS: Record<PentaType, readonly string[]> = {
  minor: ['1', '♭3', '4', '5', '♭7'],
  major: ['1', '2', '3', '5', '6'],
};

/**
 * Bünde je Pattern relativ zum Moll-Grundton auf der tiefen E-Saite (Bund f),
 * je Saite von der tiefen E- zur hohen E-Saite zwei Töne. Geprüft in den Unit-Tests.
 */
const PATTERNS: readonly (readonly [number, number])[][] = [
  [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]],
  [[3, 5], [2, 5], [2, 5], [2, 4], [3, 5], [3, 5]],
  [[5, 7], [5, 7], [5, 7], [4, 7], [5, 8], [5, 7]],
  [[7, 10], [7, 10], [7, 9], [7, 9], [8, 10], [7, 10]],
  [[10, 12], [10, 12], [9, 12], [9, 12], [10, 12], [10, 12]],
];

export const PATTERN_COUNT = PATTERNS.length;

/** Grundton der parallelen Moll-Pentatonik (Dur-Grundton − 3 Halbtöne) */
export function minorRoot(type: PentaType, root: number): number {
  return type === 'minor' ? mod(root, 12) : mod(root - 3, 12);
}

/**
 * Töne eines Patterns (1–5), aufsteigend: Saite für Saite von tief nach hoch, je Saite der tiefere Bund zuerst.
 * Liegt das ganze Pattern ab dem 12. Bund, wird es eine Oktave tiefer gezeigt.
 */
export function patternPositions(type: PentaType, root: number, n: number): Position[] {
  const f = mod(minorRoot(type, root) - 4, 12);
  let frets = PATTERNS[n - 1]!.map(([a, b]) => [f + a, f + b] as const);
  const min = Math.min(...frets.flat());
  if (min >= 12) frets = frets.map(([a, b]) => [a - 12, b - 12] as const);
  return frets.flatMap(([a, b], i) => {
    const string = (6 - i) as StringNo;
    return [
      { string, fret: a },
      { string, fret: b },
    ];
  });
}

/** Bund-Fenster eines Patterns: [niedrigster, höchster] */
export function patternSpan(positions: readonly Position[]): [number, number] {
  const frets = positions.map((p) => p.fret);
  return [Math.min(...frets), Math.max(...frets)];
}

/** Stufe eines Tons in der Tonleiter („1“, „♭3“ …) oder null, wenn er nicht dazugehört. */
export function degreeOf(type: PentaType, root: number, pc: number): string | null {
  const i = PENTA_STEPS[type].indexOf(mod(pc - root, 12));
  return i < 0 ? null : DEGREE_LABELS[type][i]!;
}

export function positionPc(p: Position): number {
  return mod(openPitchClass(p.string) + p.fret, 12);
}

/** Tonname in der Schreibweise der Tonart (Ultimate-Guitar-Grundtöne, Leiterfremde gibt es nicht) */
export function scaleNoteName(type: PentaType, root: number, pc: number, lang: Lang): string {
  // Schreibweise ableiten: Töne der Tonleiter vom Grundton aus nach Stufen benennen
  const rootSpelling = parseChord(UG_ROOTS[mod(root, 12)]!).root;
  const step = PENTA_STEPS[type].indexOf(mod(pc - root, 12));
  if (step < 0) return '';
  // Stufen in Buchstaben-Abständen: Moll 1 ♭3 4 5 ♭7 → 0 2 3 4 6; Dur 1 2 3 5 6 → 0 1 2 4 5
  const letterSteps = type === 'minor' ? [0, 2, 3, 4, 6] : [0, 1, 2, 4, 5];
  const letter = mod(rootSpelling.letter + letterSteps[step]!, 7);
  const natural = [0, 2, 4, 5, 7, 9, 11][letter]!;
  const acc = mod(pc - natural + 6, 12) - 6;
  return noteName({ letter, acc }, lang);
}

/** „a-Moll-Pentatonik“, „C-Dur-Pentatonik“ (Moll mit kleinem Anfangsbuchstaben wie bei Tonarten) */
export function pentaName(type: PentaType, root: number, lang: Lang): string {
  const name = noteName(parseChord(UG_ROOTS[mod(root, 12)]!).root, lang);
  return type === 'minor' ? `${name.toLowerCase()}-Moll-Pentatonik` : `${name}-Dur-Pentatonik`;
}

/** Spielfolge: aufwärts und wieder abwärts (ohne den obersten Ton doppelt). */
export function playOrder(positions: readonly Position[]): Position[] {
  const up = [...positions];
  return [...up, ...up.slice(0, -1).reverse()];
}

export function positionMidi(p: Position): number {
  return fretMidi(p.string, p.fret);
}
