import { LETTER_STEPS, mod, type Spelling } from './notes';

export type Lang = 'de' | 'en';

const DE_BASE = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
const EN_BASE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const EN_ACC: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

function germanName({ letter, acc }: Spelling): string {
  const base = DE_BASE[letter]!;
  if (acc === 0) return base;
  if (acc > 0) return base + 'is'.repeat(acc);
  // Be-Vorzeichen: Es, As, B sind Ausnahmen
  if (letter === 6) return acc === -1 ? 'B' : 'Heses';
  const stem = letter === 2 || letter === 5 ? base : base + 'e';
  return stem + 's' + 'es'.repeat(-acc - 1);
}

/** Tonname in der gewählten Sprache: Cis / C♯, B / B♭, Es / E♭. */
export function noteName(n: Spelling, lang: Lang): string {
  if (lang === 'de') return germanName(n);
  return EN_BASE[n.letter]! + EN_ACC[n.acc]!;
}

/** Tonklasse ohne Schreibweise: „C“, „Cis/Des“ bzw. „C♯/D♭“. */
export function pitchClassLabel(pc: number, lang: Lang): string {
  const p = mod(pc, 12);
  const natural = LETTER_STEPS.indexOf(p as (typeof LETTER_STEPS)[number]);
  if (natural >= 0) return noteName({ letter: natural, acc: 0 }, lang);
  const sharp = LETTER_STEPS.indexOf((p - 1) as (typeof LETTER_STEPS)[number]);
  const flat = LETTER_STEPS.indexOf((p + 1) as (typeof LETTER_STEPS)[number]);
  return `${noteName({ letter: sharp, acc: 1 }, lang)}/${noteName({ letter: flat, acc: -1 }, lang)}`;
}

/** Name des Stammtons (für Tastatur-Beschriftung): H im Deutsch-Modus. */
export function letterName(letter: number, lang: Lang): string {
  return (lang === 'de' ? DE_BASE : EN_BASE)[letter]!;
}
