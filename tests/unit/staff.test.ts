import { describe, expect, it } from 'vitest';
import { firstPosition, positionText } from '../../src/music/guitar';
import { parseNote, soundingMidi } from '../../src/music/notes';
import { ledgerLines, staffPositionText } from '../../src/music/staff';

/** PLAN 4.4 – geprüfte Soll-Werte. */
const TABLE: [string, string, string | null][] = [
  ['E3', 'unter der 3. Hilfslinie unten', 'tiefe E-Saite leer'],
  ['F3', '3. Hilfslinie unten', 'tiefe E-Saite, 1. Bund'],
  ['G3', 'unter der 2. Hilfslinie unten', 'tiefe E-Saite, 3. Bund'],
  ['A3', '2. Hilfslinie unten', 'A-Saite leer'],
  ['B3', 'unter der 1. Hilfslinie unten', 'A-Saite, 2. Bund'],
  ['C4', '1. Hilfslinie unten', 'A-Saite, 3. Bund'],
  ['D4', 'direkt unter dem System', 'D-Saite leer'],
  ['E4', '1. Linie', 'D-Saite, 2. Bund'],
  ['F4', '1. Zwischenraum', 'D-Saite, 3. Bund'],
  ['G4', '2. Linie', 'G-Saite leer'],
  ['A4', '2. Zwischenraum', 'G-Saite, 2. Bund'],
  ['B4', '3. Linie', 'H-Saite leer'],
  ['C5', '3. Zwischenraum', 'H-Saite, 1. Bund'],
  ['D5', '4. Linie', 'H-Saite, 3. Bund'],
  ['E5', '4. Zwischenraum', 'hohe E-Saite leer'],
  ['F5', '5. Linie', 'hohe E-Saite, 1. Bund'],
  ['G5', 'direkt über dem System', 'hohe E-Saite, 3. Bund'],
  ['A5', '1. Hilfslinie oben', null],
  ['C6', '2. Hilfslinie oben', null],
  ['E6', '3. Hilfslinie oben', null],
];

describe('Lage im Notensystem (PLAN 4.4)', () => {
  it.each(TABLE)('%s: %s', (note, text) => {
    expect(staffPositionText(parseNote(note))).toBe(text);
  });

  it('Zwischenräume ober- und unterhalb der Hilfslinien', () => {
    expect(staffPositionText(parseNote('B5'))).toBe('über der 1. Hilfslinie oben');
    expect(staffPositionText(parseNote('D3'))).toBe('4. Hilfslinie unten');
  });

  it('Hilfslinien zählen', () => {
    expect(ledgerLines(parseNote('E3'))).toBe(-3);
    expect(ledgerLines(parseNote('F3'))).toBe(-3);
    expect(ledgerLines(parseNote('D4'))).toBe(0);
    expect(ledgerLines(parseNote('G5'))).toBe(0);
    expect(ledgerLines(parseNote('A5'))).toBe(1);
    expect(ledgerLines(parseNote('B5'))).toBe(1);
    expect(ledgerLines(parseNote('E6'))).toBe(3);
  });
});

describe('Stelle auf der Gitarre in der 1. Lage (PLAN 4.4)', () => {
  it.each(TABLE)('%s', (note, _text, guitar) => {
    const pos = firstPosition(soundingMidi(parseNote(note)));
    expect(pos ? positionText(pos, 'de') : null).toBe(guitar);
  });

  it('B4 geht auch auf der G-Saite im 4. Bund, bevorzugt ist die Leersaite', () => {
    expect(firstPosition(59)).toEqual({ string: 2, fret: 0 });
  });

  it('E6 ist die hohe E-Saite im 12. Bund', () => {
    expect(soundingMidi(parseNote('E6')) - 64).toBe(12);
  });
});
