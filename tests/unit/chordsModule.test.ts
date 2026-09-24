import { describe, expect, it } from 'vitest';
import { chordAnswerText, pressChordAccidental, pressRoot, pressSuffix } from '../../src/input/chordKeyboard';
import { gradeParts, isComplete } from '../../src/learn/session';
import { chordExplain, chordById, chordsModule, chordTitle, shapeNames, shapeOk } from '../../src/modules/chords';
import { defaultSettings, type ChordQuestion, type MakeContext, type NotesQuestion, type ShapeQuestion } from '../../src/modules/types';
import { parseChord, parseShape } from '../../src/music/chords';
import { CHANGE_CHORDS, formatClock, pairKey } from '../../src/screens/changes';

const ctx = (forced: string, lang: 'de' | 'en' = 'de'): MakeContext => ({ lang, forced, recent: [], stats: {}, now: 0, rng: () => 0.5 });
const settings = defaultSettings(chordsModule.settings);

describe('M5 Akkorde', () => {
  it('Defaults: 8 Grundakkorde, gemischt; Schlüssel chn/chs/cht', () => {
    expect(settings).toMatchObject({ sets: ['basic'], task: 'mixed' });
    const keys = chordsModule.keys(settings);
    expect(keys).toHaveLength(24);
    expect(keys).toContain('chn:Am');
    expect(keys).toContain('chs:G');
    expect(keys).toContain('cht:C');
  });

  it('Diagramm → Name: Grundton-Tonklasse und Zusatz', () => {
    const q = chordsModule.make(settings, ctx('chn:Am')) as ChordQuestion;
    expect(q.kind).toBe('chord');
    expect(gradeParts(q, { root: { letter: 5, acc: 0 }, suffix: 'm' })).toEqual([true]);
    expect(gradeParts(q, { root: { letter: 5, acc: 0 }, suffix: '' })).toEqual([false]);
    // gleiche Tonklasse, andere Schreibweise zählt (Grundton-Tonklasse)
    const b7 = chordsModule.make({ ...settings, sets: ['seven'] }, ctx('chn:B7')) as ChordQuestion;
    expect(gradeParts(b7, { root: { letter: 0, acc: -1 }, suffix: '7' })).toEqual([true]);
    expect(isComplete(q, { root: { letter: 5, acc: 0 }, suffix: null })).toBe(false);
    expect(q.describe!({ root: { letter: 0, acc: 0 }, suffix: '' })).toBe('Das wäre C (C-Dur) mit den Tönen C E G.');
  });

  it('Griff setzen: alternative Griffe zählen, C7 ohne Quinte ist richtig', () => {
    const c = parseChord('C');
    expect(shapeOk(parseShape('x32010'), c)).toBe(true);
    expect(shapeOk(parseShape('x35553'), c)).toBe(true); // Barré-Griff A-Form
    expect(shapeOk(parseShape('332010'), c)).toBe(true); // G im Bass: Umkehrung
    expect(shapeOk(parseShape('x32000'), c)).toBe(false); // H ist fremd (Cmaj7)
    expect(shapeOk(parseShape('x3xxxx'), c)).toBe(false); // zu wenige Saiten
    expect(shapeOk(parseShape('x32310'), parseChord('C7'))).toBe(true);
    expect(shapeOk(parseShape('022xxx'), parseChord('E5'))).toBe(true); // Powerchord: 2+ Saiten reichen
  });

  it('Griff setzen: Rückmeldung, Umkehrung, Tonnamen je Saite', () => {
    const q = chordsModule.make(settings, ctx('chs:C')) as ShapeQuestion;
    expect(q.kind).toBe('shape');
    expect(q.prompt).toBe('Setze den Griff für C (C-Dur).');
    expect(q.grade(parseShape('x35553'))).toBe(true);
    expect(q.noteOk!(parseShape('x32010'))).toBe('');
    expect(q.noteOk!(parseShape('332010'))).toBe('Richtig – mit G im Bass ist es eine Umkehrung.');
    expect(q.describe!(parseShape('x32000'))).toBe('Gehört nicht dazu: H.');
    expect(q.describe!(parseShape('x32x1x'))).toBe('Es fehlt: G.');
    expect(q.describe!(parseShape('x3xxxx'))).toBe('Es fehlt: E, G. Spiele mindestens drei Saiten.');
    expect(shapeNames(parseShape('x32010'), parseChord('C'), 'de')).toEqual([null, 'C', 'E', 'G', 'C', 'E']);
    expect(shapeNames(parseShape('x21202'), parseChord('B7'), 'de')).toEqual([null, 'H', 'Dis', 'A', 'H', 'Fis']);
  });

  it('Akkordtöne: Reihenfolge egal, Vergleich nach Tonklasse', () => {
    const q = chordsModule.make(settings, ctx('cht:A')) as NotesQuestion;
    expect(q.unordered).toBe(true);
    expect(q.fields).toHaveLength(3);
    const E = { letter: 2, acc: 0 };
    const A = { letter: 5, acc: 0 };
    const Cis = { letter: 0, acc: 1 };
    const Des = { letter: 1, acc: -1 };
    expect(gradeParts(q, [E, Cis, A])).toEqual([true, true, true]);
    expect(gradeParts(q, [Des, A, E])).toEqual([true, true, true]);
    expect(gradeParts(q, [A, A, E])).toEqual([true, false, true]);
  });

  it('Erklärung: Formel, Töne, Aussprache, H/B-Falle', () => {
    const b7 = chordExplain(chordById('B7')!, 'de');
    expect(b7).toContain('Dominantseptakkord');
    expect(b7).toContain('H Dis Fis A');
    expect(b7).toContain('Auf Ultimate Guitar steht B7, auf Deutsch sagt man H7.');
    expect(chordExplain(chordById('B7')!, 'en')).not.toContain('H/B-Falle');
    expect(chordExplain(chordById('C7')!, 'de')).toContain('fehlt die Quinte');
    expect(chordTitle(parseChord('Bm'), 'Bm', 'de')).toBe('Bm (h-Moll)');
    expect(chordTitle(parseChord('A7'), 'A7', 'de')).toBe('A7');
    expect(chordTitle(parseChord('Bm'), 'Bm', 'en')).toBe('Bm');
  });
});

describe('Akkordtastatur', () => {
  it('Grundton, Vorzeichen (zweiter Druck schaltet zurück), Zusatz', () => {
    let a = pressRoot({ root: null, suffix: null }, 3);
    a = pressChordAccidental(a, 1);
    a = pressSuffix(a, 'm');
    expect(chordAnswerText(a, 'de')).toBe('F#m (fis-Moll)');
    expect(chordAnswerText(a, 'en')).toBe('F#m');
    expect(pressChordAccidental(a, 1).root).toEqual({ letter: 3, acc: 0 });
    expect(pressChordAccidental({ root: null, suffix: null }, 1).root).toBeNull();
    expect(chordAnswerText(pressSuffix(pressRoot({ root: null, suffix: null }, 6), ''), 'de')).toBe('B (H-Dur)');
  });
});

describe('Akkordwechsel-Trainer', () => {
  it('Auswahl: Grundakkorde, F, Fmaj7, Septakkorde', () => {
    expect(CHANGE_CHORDS.map((c) => c.id)).toEqual(['A', 'D', 'E', 'Am', 'Em', 'Dm', 'G', 'C', 'Fs', 'Fmaj7', 'E7', 'A7', 'D7', 'G7', 'C7', 'B7']);
  });

  it('Bestwert pro Paar unabhängig von der Reihenfolge', () => {
    expect(pairKey('D', 'A')).toBe(pairKey('A', 'D'));
  });

  it('Uhr', () => {
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(9_100)).toBe('0:10');
    expect(formatClock(-5)).toBe('0:00');
  });
});
