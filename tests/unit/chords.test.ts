import { describe, expect, it } from 'vitest';
import { noteName } from '../../src/music/names';
import {
  capoChain,
  capoFret,
  capoSounding,
  checkShape,
  chordSpoken,
  chordSymbol,
  chordTones,
  CHORDS,
  parseChord,
  parseShape,
} from '../../src/music/chords';

const tones = (symbol: string, lang: 'de' | 'en' = 'de') =>
  chordTones(parseChord(symbol)).map((t) => noteName(t, lang)).join(' ');

/** PLAN 4.6, Spalte „Töne (deutsch)“; bei C7 fehlt G im Griff, gehört aber zur Formel. */
const EXPECTED_TONES: Record<string, string> = {
  A: 'A Cis E', D: 'D Fis A', E: 'E Gis H', Am: 'A C E', Em: 'E G H', Dm: 'D F A', G: 'G H D', C: 'C E G',
  Fs: 'F A C', Fmaj7: 'F A C E', Cadd9: 'C E G D', Dsus4: 'D G A', Dsus2: 'D E A', Asus2: 'A H E',
  Asus4: 'A D E', Em7: 'E G H D', Am7: 'A C E G', Cmaj7: 'C E G H', E7: 'E Gis H D', A7: 'A Cis E G',
  D7: 'D Fis A C', G7: 'G H D F', C7: 'C E G B', B7: 'H Dis Fis A', Fb: 'F A C', Bm: 'H D Fis',
  E5: 'E H', A5: 'A E',
};

describe('Akkorde (PLAN 4.6)', () => {
  it.each(CHORDS.map((c) => [c.label, c] as const))('%s: Griff passt zur Formel', (_label, chord) => {
    const result = checkShape(parseShape(chord.shape), parseChord(chord.symbol));
    expect(result.missing).toEqual([]);
    expect(result.foreign).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.inversion).toBe(false);
  });

  it.each(CHORDS.map((c) => [c.label, c] as const))('%s: Akkordtöne', (_label, chord) => {
    expect(tones(chord.symbol)).toBe(EXPECTED_TONES[chord.id]);
  });

  it('C7 im Griff ohne Quinte gilt als richtig', () => {
    const shape = parseShape('x32310');
    expect(checkShape(shape, parseChord('C7')).ok).toBe(true);
  });

  it('fehlende Quinte ist nur bei Septakkorden erlaubt', () => {
    // C ohne G: x32x1x → C E C
    const noFifth = checkShape(parseShape('x32x1x'), parseChord('C'));
    expect(noFifth.ok).toBe(false);
    expect(noFifth.missing).toEqual([7]);
  });

  it('fremde Töne und Umkehrungen', () => {
    const wrong = checkShape(parseShape('x02220'), parseChord('Am'));
    expect(wrong.ok).toBe(false);
    expect(wrong.foreign).toEqual([1]);
    // 022010 = E H E G C E → H ist fremd
    expect(checkShape(parseShape('022010'), parseChord('C')).foreign).toEqual([11]);
    // 032010 = E C E G C E → C-Dur mit E im Bass
    const firstInv = checkShape(parseShape('032010'), parseChord('C'));
    expect(firstInv.ok).toBe(true);
    expect(firstInv.inversion).toBe(true);
  });

  it('Akkordtöne-Schreibweise', () => {
    expect(tones('A')).toBe('A Cis E');
    expect(tones('B7')).toBe('H Dis Fis A');
    expect(tones('B7', 'en')).toBe('B D♯ F♯ A');
    expect(tones('Bb')).toBe('B D F');
    expect(tones('F#m')).toBe('Fis A Cis');
  });

  it('deutsche Aussprache', () => {
    expect(chordSpoken(parseChord('Bm'), 'de')).toBe('h-Moll');
    expect(chordSpoken(parseChord('B7'), 'de')).toBe('H7');
    expect(chordSpoken(parseChord('G'), 'de')).toBe('G-Dur');
    expect(chordSpoken(parseChord('Bb'), 'de')).toBe('B-Dur');
    expect(chordSpoken(parseChord('B'), 'de')).toBe('H-Dur');
    expect(chordSpoken(parseChord('Am'), 'de')).toBe('a-Moll');
    expect(chordSpoken(parseChord('F#m'), 'de')).toBe('fis-Moll');
  });

  it('Symbole bleiben international', () => {
    expect(chordSymbol(parseChord('F#m'))).toBe('F#m');
    expect(chordSymbol(parseChord('Bb'))).toBe('Bb');
    expect(() => parseChord('Hm')).toThrow();
  });
});

describe('Capo (PLAN 4.6)', () => {
  it('Soll-Werte', () => {
    expect(capoSounding('G', 2)).toBe('A');
    expect(capoSounding('C', 2)).toBe('D');
    expect(capoSounding('Em', 3)).toBe('Gm');
    expect(capoSounding('A', 1)).toBe('Bb');
    expect(capoSounding('E', 4)).toBe('Ab');
  });

  it('Halbtonkette', () => {
    expect(capoChain('G', 2)).toBe('G → Ab → A');
  });

  it('Welcher Bund?', () => {
    expect(capoFret('A', 'G')).toBe(2);
    expect(capoFret('Gm', 'Em')).toBe(3);
    expect(capoFret('C', 'D')).toBe(10);
  });
});
