import { describe, expect, it } from 'vitest';
import { letterName, noteName, pitchClassLabel } from '../../src/music/names';
import { parseNote } from '../../src/music/notes';

const n = (text: string) => parseNote(text);

describe('Notennamen deutsch/englisch (PLAN 8)', () => {
  it.each([
    ['C#4', 'Cis', 'C♯'],
    ['Bb3', 'B', 'B♭'],
    ['Eb4', 'Es', 'E♭'],
    ['Ab4', 'As', 'A♭'],
    ['B4', 'H', 'B'],
    ['Db4', 'Des', 'D♭'],
    ['Gb4', 'Ges', 'G♭'],
    ['Cb4', 'Ces', 'C♭'],
    ['Fb4', 'Fes', 'F♭'],
    ['E#4', 'Eis', 'E♯'],
    ['B#3', 'His', 'B♯'],
    ['F#4', 'Fis', 'F♯'],
    ['A#4', 'Ais', 'A♯'],
    ['C4', 'C', 'C'],
  ])('%s → %s / %s', (note, de, en) => {
    expect(noteName(n(note), 'de')).toBe(de);
    expect(noteName(n(note), 'en')).toBe(en);
  });

  it('Tonklassen-Labels', () => {
    expect(pitchClassLabel(1, 'de')).toBe('Cis/Des');
    expect(pitchClassLabel(10, 'de')).toBe('Ais/B');
    expect(pitchClassLabel(10, 'en')).toBe('A♯/B♭');
    expect(pitchClassLabel(3, 'de')).toBe('Dis/Es');
    expect(pitchClassLabel(8, 'de')).toBe('Gis/As');
    expect(pitchClassLabel(11, 'de')).toBe('H');
    expect(pitchClassLabel(11, 'en')).toBe('B');
    expect(pitchClassLabel(-1, 'de')).toBe('H');
  });

  it('Stammtöne für die Tastatur', () => {
    expect(letterName(6, 'de')).toBe('H');
    expect(letterName(6, 'en')).toBe('B');
  });
});
