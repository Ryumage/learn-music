import { describe, expect, it } from 'vitest';
import {
  easiestPosition,
  fretDerivation,
  fretMidi,
  OPEN_MIDI,
  playable,
  positionsOf,
  stringLetter,
  stringName,
} from '../../src/music/guitar';

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

describe('Spielbarkeit von Mehrklängen (PLAN M2)', () => {
  it('Positivbeispiele', () => {
    // G3 + H3 + D4 (G-Dur-Dreiklang, 1. Lage)
    expect(playable([43, 47, 50], 4)).not.toBeNull();
    // Leersaiten E und H
    expect(playable([40, 59], 4)).not.toBeNull();
    // Oktave e und E im 12. Bund-Bereich
    expect(playable([52, 64], 12)).not.toBeNull();
  });

  it('jeder Ton auf einer eigenen Saite', () => {
    const pos = playable([45, 50, 55, 59], 4)!;
    expect(new Set(pos.map((p) => p.string)).size).toBe(4);
  });

  it('Negativbeispiele', () => {
    // E2 und F2 liegen nur auf der tiefen E-Saite
    expect(playable([40, 41], 4)).toBeNull();
    // zu hoch für die 1. Lage
    expect(playable([60, 69], 4)).toBeNull();
    // F2 nur auf der tiefen E-Saite (1. Bund), A4 frühestens hohe E-Saite 5. Bund: Spannweite 4
    expect(playable([41, 69], 12)).toBeNull();
    expect(playable([41, 69], 12, 4)).not.toBeNull();
    // sieben Töne passen nicht auf sechs Saiten
    expect(playable([40, 45, 50, 55, 59, 64, 69], 12)).toBeNull();
  });

  it('gegriffene Bünde höchstens 3 auseinander, Leersaiten zählen nicht', () => {
    // F2 (E-Saite 1) + Gis3 (G-Saite 1) + hohe E-Saite leer
    expect(playable([41, 56, 64], 4)).not.toBeNull();
    // Ais2 (A-Saite 1) + E4: auf der H-Saite (5. Bund) zu weit, als Leersaite passt es
    const p = playable([46, 64], 5)!;
    expect(p).toEqual([
      { string: 5, fret: 1 },
      { string: 1, fret: 0 },
    ]);
  });

  it('bequemste Stelle', () => {
    expect(easiestPosition(69)).toEqual({ string: 1, fret: 5 });
  });
});
