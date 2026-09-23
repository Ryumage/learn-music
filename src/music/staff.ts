import { diatonic, type Note } from './notes';

/** Unterste Linie des Violinschlüssels ist e' (E4). */
export const BOTTOM_LINE = diatonic({ letter: 2, octave: 4 });

/** Abstand in diatonischen Schritten zur untersten Linie (0 = 1. Linie, 1 = 1. Zwischenraum …). */
export function staffStep(n: Pick<Note, 'letter' | 'octave'>): number {
  return diatonic(n) - BOTTOM_LINE;
}

/** Lage im Notensystem als Text, z. B. „2. Hilfslinie unten“ (PLAN 4.4). */
export function staffPositionText(n: Pick<Note, 'letter' | 'octave'>): string {
  const d = staffStep(n);
  if (d >= 0 && d <= 8) return d % 2 === 0 ? `${d / 2 + 1}. Linie` : `${(d + 1) / 2}. Zwischenraum`;
  if (d === -1) return 'direkt unter dem System';
  if (d === 9) return 'direkt über dem System';
  if (d < 0) return d % 2 === 0 ? `${-d / 2}. Hilfslinie unten` : `unter der ${(-d - 1) / 2}. Hilfslinie unten`;
  return d % 2 === 0 ? `${(d - 8) / 2}. Hilfslinie oben` : `über der ${(d - 9) / 2}. Hilfslinie oben`;
}

/** Anzahl Hilfslinien, die eine Note braucht: negativ = unten, positiv = oben. */
export function ledgerLines(n: Pick<Note, 'letter' | 'octave'>): number {
  const d = staffStep(n);
  if (d <= -2) return -Math.floor(-d / 2);
  if (d >= 10) return Math.floor((d - 8) / 2);
  return 0;
}
