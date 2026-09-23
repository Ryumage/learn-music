import { describe, expect, it } from 'vitest';
import {
  diatonic,
  fromMidi,
  midi,
  noteKey,
  parseNote,
  pitchClass,
  samePitchClass,
  sameSpelling,
  soundingMidi,
} from '../../src/music/notes';

describe('Töne', () => {
  it('MIDI-Werte', () => {
    expect(midi(parseNote('C4'))).toBe(60);
    expect(midi(parseNote('A4'))).toBe(69);
    expect(midi(parseNote('E3'))).toBe(52);
    expect(midi(parseNote('Cb4'))).toBe(59);
    expect(midi(parseNote('B#3'))).toBe(60);
  });

  it('diatonischer Schritt = octave·7 + letter', () => {
    expect(diatonic(parseNote('C4'))).toBe(28);
    expect(diatonic(parseNote('E4'))).toBe(30);
  });

  it('Tonklasse', () => {
    expect(pitchClass({ letter: 6, acc: -1 })).toBe(10);
    expect(pitchClass({ letter: 0, acc: -1 })).toBe(11);
  });

  it('Schlüssel und Parser sind umkehrbar', () => {
    for (const k of ['F#4', 'Bb3', 'C5', 'Ebb4', 'G##2']) expect(noteKey(parseNote(k))).toBe(k);
    expect(() => parseNote('H4')).toThrow();
  });

  it('aus MIDI mit ♯ oder ♭', () => {
    expect(noteKey(fromMidi(61))).toBe('C#4');
    expect(noteKey(fromMidi(61, 'flat'))).toBe('Db4');
    expect(noteKey(fromMidi(59, 'flat'))).toBe('B3');
  });

  it('Vergleich nach Schreibweise und nach Tonklasse (PLAN 4.3)', () => {
    const cis = { letter: 0, acc: 1 };
    const des = { letter: 1, acc: -1 };
    expect(sameSpelling(cis, des)).toBe(false);
    expect(samePitchClass(cis, des)).toBe(true);
  });

  it('Gitarre klingt eine Oktave tiefer als notiert', () => {
    expect(soundingMidi(parseNote('E3'))).toBe(40);
    expect(soundingMidi(parseNote('E5'))).toBe(64);
  });
});
