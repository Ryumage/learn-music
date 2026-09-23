/** Töne: Buchstabe 0–6 (C D E F G A B), Vorzeichen −2…+2, Oktave (wissenschaftlich, C4 = eingestrichenes c). */
export interface Note {
  letter: number;
  acc: number;
  octave: number;
}

/** Tonname ohne Oktave (für Eingaben und Akkordtöne). */
export interface Spelling {
  letter: number;
  acc: number;
}

export const LETTERS = 'CDEFGAB';
export const LETTER_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function midi(n: Note): number {
  return 12 * (n.octave + 1) + LETTER_STEPS[n.letter]! + n.acc;
}

/** Diatonischer Schritt: octave·7 + letter. */
export function diatonic(n: Pick<Note, 'letter' | 'octave'>): number {
  return n.octave * 7 + n.letter;
}

export function pitchClass(n: Spelling): number {
  return mod(LETTER_STEPS[n.letter]! + n.acc, 12);
}

const ACC_ASCII: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

/** Schlüssel wie „F#4“, „Bb3“, „C5“. */
export function noteKey(n: Note): string {
  return `${LETTERS[n.letter]}${ACC_ASCII[n.acc]}${n.octave}`;
}

export function parseNote(text: string): Note {
  const m = /^([A-G])(##|#|bb|b)?(-?\d+)$/.exec(text);
  if (!m) throw new Error(`Ungültige Note: ${text}`);
  const acc = { '': 0, '#': 1, '##': 2, b: -1, bb: -2 }[m[2] ?? '']!;
  return { letter: LETTERS.indexOf(m[1]!), acc, octave: Number(m[3]) };
}

/** Note aus MIDI, schwarze Tasten als ♯ (prefer 'sharp') oder ♭. */
export function fromMidi(value: number, prefer: 'sharp' | 'flat' = 'sharp'): Note {
  const pc = mod(value, 12);
  const octave = Math.floor(value / 12) - 1;
  let letter = LETTER_STEPS.indexOf(pc as (typeof LETTER_STEPS)[number]);
  let acc = 0;
  if (letter < 0) {
    if (prefer === 'sharp') {
      letter = LETTER_STEPS.indexOf((pc - 1) as (typeof LETTER_STEPS)[number]);
      acc = 1;
    } else {
      letter = LETTER_STEPS.indexOf((pc + 1) as (typeof LETTER_STEPS)[number]);
      acc = -1;
    }
  }
  return { letter, acc, octave };
}

export function sameSpelling(a: Spelling, b: Spelling): boolean {
  return a.letter === b.letter && a.acc === b.acc;
}

export function samePitchClass(a: Spelling, b: Spelling): boolean {
  return pitchClass(a) === pitchClass(b);
}

/** Gitarre klingt eine Oktave tiefer als notiert. */
export const GUITAR_TRANSPOSE = 12;

export function soundingMidi(notated: Note): number {
  return midi(notated) - GUITAR_TRANSPOSE;
}
