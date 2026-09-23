import { describe, expect, it } from 'vitest';
import { fretDerivation, fretMidi, OPEN_MIDI, positionsOf, stringLetter, stringName } from '../../src/music/guitar';

describe('Gitarre', () => {
  it('Leersaiten klingend (PLAN 4.1)', () => {
    expect(OPEN_MIDI).toEqual({ 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 });
  });

  it('Bund f auf Saite s = Leersaite + f', () => {
    expect(fretMidi(5, 3)).toBe(48);
  });

  it('Saitennamen deutsch und englisch', () => {
    expect([6, 5, 4, 3, 2, 1].map((s) => stringLetter(s as 1, 'de')).join(' ')).toBe('E A D G H e');
    expect(stringLetter(2, 'en')).toBe('B');
    expect(stringName(2, 'de')).toBe('H-Saite');
    expect(stringName(2, 'en')).toBe('B-Saite');
    expect(stringName(6, 'de')).toBe('tiefe E-Saite');
  });

  it('alle Stellen eines Tons', () => {
    expect(positionsOf(64, 12)).toEqual([
      { string: 3, fret: 9 },
      { string: 2, fret: 5 },
      { string: 1, fret: 0 },
    ]);
    expect(positionsOf(64, 24)).toHaveLength(6);
  });

  it('Herleitung (PLAN 4.5)', () => {
    expect(fretDerivation({ string: 5, fret: 3 }, 'de')).toBe('A-Saite, 3. Bund: A → Ais/B → H → C');
    expect(fretDerivation({ string: 5, fret: 0 }, 'de')).toBe('A-Saite leer: A');
    expect(fretDerivation({ string: 1, fret: 14 }, 'de')).toBe(
      'hohe E-Saite, 14. Bund: 12. Bund = Oktave der Leersaite: E → F → Fis/Ges',
    );
    expect(fretDerivation({ string: 5, fret: 3 }, 'en')).toBe('A-Saite, 3. Bund: A → A♯/B♭ → B → C');
  });
});
