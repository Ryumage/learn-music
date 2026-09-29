import { describe, expect, it } from 'vitest';
import { keyboardSuffixes, chordsModule } from '../../src/modules/chords';
import { gradeParts } from '../../src/learn/session';
import { defaultSettings, type ChordQuestion, type MakeContext, type NotesQuestion } from '../../src/modules/types';
import { CHORD_TYPES, CHORDS, gripById, LIBRARY, libraryChord, maxFret, voicingLabel, voicingOk } from '../../src/music/chordLibrary';
import { checkShape, chordTones, parseChord, parseShape, shapeText, SUFFIXES, UG_ROOTS } from '../../src/music/chords';
import { noteName } from '../../src/music/names';

const tones = (symbol: string) =>
  chordTones(parseChord(symbol))
    .map((t) => noteName(t, 'de'))
    .join(' ');

describe('Akkord-Bibliothek: Umfang', () => {
  it('12 Grundtöne × 17 Akkordtypen, jeder mit mindestens einem Griff', () => {
    expect(CHORD_TYPES.map((t) => t.suffix)).toEqual(SUFFIXES);
    expect(LIBRARY).toHaveLength(12 * 17);
    for (const root of UG_ROOTS) for (const t of CHORD_TYPES) expect(libraryChord(root + t.suffix)?.voicings.length, root + t.suffix).toBeGreaterThan(0);
  });

  it('Dur, Moll, 7 und m7 haben je mindestens zwei Griffe (E- und A-Form)', () => {
    for (const c of LIBRARY.filter((x) => ['', 'm', '7', 'm7'].includes(x.suffix))) expect(c.voicings.length, c.symbol).toBeGreaterThanOrEqual(2);
  });

  it('keine doppelten Griffe je Akkord', () => {
    for (const c of LIBRARY) expect(new Set(c.voicings.map((v) => v.shape)).size, c.symbol).toBe(c.voicings.length);
  });
});

describe('Akkord-Bibliothek: jeder Griff ist geprüft', () => {
  const all = LIBRARY.flatMap((c) => c.voicings.map((v) => [`${c.symbol} ${v.shape}`, c, v] as const));

  it.each(all)('%s passt zur Formel', (_n, c, v) => {
    const r = checkShape(parseShape(v.shape), parseChord(c.symbol));
    expect(r.foreign).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(voicingOk(c, v)).toBe(true);
  });

  it.each(all)('%s: Grundton im Bass, spielbar, genug Saiten', (_n, c, v) => {
    const shape = parseShape(v.shape);
    expect(checkShape(shape, parseChord(c.symbol)).inversion).toBe(false);
    const fretted = shape.filter((f): f is number => f !== null && f > 0);
    // Spannweite höchstens 4 Bünde (z. B. Bund 3–6)
    if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
    expect(shape.filter((f) => f !== null).length).toBeGreaterThanOrEqual(c.suffix === '5' ? 2 : 3);
    expect(maxFret(v)).toBeLessThanOrEqual(15);
  });

  it.each(all.filter(([, , v]) => v.fingers))('%s: Fingersatz passt zum Griff', (_n, _c, v) => {
    const shape = parseShape(v.shape);
    const fingers = [...v.fingers!];
    expect(fingers).toHaveLength(6);
    const fretOf = new Map<string, number>();
    shape.forEach((f, i) => {
      const fg = fingers[i]!;
      if (f === null) expect(fg).toBe('x');
      else if (f === 0) expect(fg).toBe('0');
      else {
        expect(fg).toMatch(/^[1-4]$/);
        // ein Finger liegt nur in einem Bund (mehrere Saiten = Barré)
        if (fretOf.has(fg)) expect(fretOf.get(fg)).toBe(f);
        fretOf.set(fg, f);
      }
    });
  });

  it('Schreibweise ab Bund 10 mit Bindestrichen, Rundlauf', () => {
    expect(parseShape('x-10-12-12-12-10')).toEqual([null, 10, 12, 12, 12, 10]);
    expect(shapeText([null, 10, 12, 12, 12, 10])).toBe('x-10-12-12-12-10');
    expect(shapeText([null, 3, 2, 0, 1, 0])).toBe('x32010');
    for (const c of LIBRARY) for (const v of c.voicings) expect(shapeText(parseShape(v.shape))).toBe(v.shape);
  });
});

describe('Akkord-Bibliothek: Stichproben', () => {
  it('bekannte Barré-Griffe entstehen aus den Formen', () => {
    const has = (symbol: string, shape: string) => libraryChord(symbol)!.voicings.some((v) => v.shape === shape);
    expect(has('F', '133211')).toBe(true);
    expect(has('Bm', 'x24432')).toBe(true);
    expect(has('C#m', 'x46654')).toBe(true);
    expect(has('G', '355433')).toBe(true);
    expect(has('Bb', 'x13331')).toBe(true);
    expect(has('F#m', '244222')).toBe(true);
    expect(has('C9', 'x3233x')).toBe(true);
    expect(has('Cdim7', 'x3424x')).toBe(true);
    expect(has('Bm7b5', 'x2323x')).toBe(true);
  });

  it('offene Griffe zuerst, Standardgriff wie bisher', () => {
    expect(libraryChord('C')!.voicings[0]).toMatchObject({ shape: 'x32010', form: 'open' });
    expect(libraryChord('Bm')!.voicings[0]).toMatchObject({ shape: 'x24432', form: 'a', fret: 2 });
    expect(voicingLabel(libraryChord('Bm')!.voicings[0]!)).toBe('Grundton A-Saite, 2. Bund');
    expect(voicingLabel(libraryChord('C')!.voicings[0]!)).toBe('offen');
  });

  it('neue Akkordtypen: Töne mit richtiger Schreibweise', () => {
    expect(tones('C6')).toBe('C E G A');
    expect(tones('Am6')).toBe('A C E Fis');
    expect(tones('G9')).toBe('G H D F A');
    expect(tones('Dsus4')).toBe('D G A');
    expect(tones('E7sus4')).toBe('E A H D');
    expect(tones('Bdim')).toBe('H D F');
    expect(tones('Cdim7')).toBe('C Es Ges Heses');
    expect(tones('Caug')).toBe('C E Gis');
    expect(tones('Bm7b5')).toBe('H D F A');
  });
});

describe('Lernmodule laden aus der Bibliothek', () => {
  /** Griffe der ersten Version – Kennungen, Griffe und Fingersätze bleiben gleich (Lernstand!) */
  const V1: [string, string, string, string | null][] = [
    ['A', 'A', 'x02220', 'x01230'],
    ['D', 'D', 'xx0232', 'xx0132'],
    ['E', 'E', '022100', '023100'],
    ['Am', 'Am', 'x02210', 'x02310'],
    ['Em', 'Em', '022000', '023000'],
    ['Dm', 'Dm', 'xx0231', 'xx0231'],
    ['G', 'G', '320003', '210003'],
    ['C', 'C', 'x32010', 'x32010'],
    ['Fs', 'F', 'xx3211', 'xx3211'],
    ['Fmaj7', 'Fmaj7', 'xx3210', 'xx3210'],
    ['Cadd9', 'Cadd9', 'x32030', null],
    ['Dsus4', 'Dsus4', 'xx0233', 'xx0134'],
    ['Dsus2', 'Dsus2', 'xx0230', 'xx0130'],
    ['Asus2', 'Asus2', 'x02200', 'x01200'],
    ['Asus4', 'Asus4', 'x02230', null],
    ['Em7', 'Em7', '022030', null],
    ['Am7', 'Am7', 'x02010', 'x02010'],
    ['Cmaj7', 'Cmaj7', 'x32000', 'x32000'],
    ['E7', 'E7', '020100', '020100'],
    ['A7', 'A7', 'x02020', 'x02030'],
    ['D7', 'D7', 'xx0212', 'xx0213'],
    ['G7', 'G7', '320001', '320001'],
    ['C7', 'C7', 'x32310', 'x32410'],
    ['B7', 'B7', 'x21202', 'x21304'],
    ['Fb', 'F', '133211', '134211'],
    ['Bm', 'Bm', 'x24432', 'x13421'],
    ['E5', 'E5', '022xxx', '013xxx'],
    ['A5', 'A5', 'x022xx', 'x013xx'],
  ];

  it.each(V1)('%s bleibt gleich', (id, symbol, shape, fingers) => {
    expect(CHORDS.find((c) => c.id === id)).toMatchObject({ symbol, shape, fingers });
  });

  it('jeder Lern-Akkord ist ein Griff der Bibliothek', () => {
    for (const c of CHORDS) expect(libraryChord(c.symbol)!.voicings.some((v) => v.shape === c.shape && v.fingers === c.fingers), c.id).toBe(true);
  });

  it('neue Sätze: alle 24 Dur/Moll und die ganze Bibliothek', () => {
    const dm = CHORDS.filter((c) => c.sets.includes('dm24'));
    expect(dm).toHaveLength(24);
    expect(dm.find((c) => c.symbol === 'F')!.id).toBe('Fb');
    expect(CHORDS.filter((c) => c.sets.includes('all'))).toHaveLength(204);
    expect(CHORDS.find((c) => c.id === 'C#m')).toMatchObject({ shape: 'x46654', sets: ['dm24', 'all'] });
  });

  it('M5 mit der ganzen Bibliothek: alle drei Aufgaben für alle 204 Akkorde, Tastatur mit allen Zusätzen', () => {
    const settings = { ...defaultSettings(chordsModule.settings), sets: ['all'] };
    const keys = chordsModule.keys(settings);
    for (const p of ['chn:', 'chs:', 'cht:']) expect(keys.filter((k) => k.startsWith(p))).toHaveLength(204);
    const ctx: MakeContext = { lang: 'de', forced: 'chn:Cdim7', recent: [], stats: {}, now: 0, rng: () => 0.5 };
    const q = chordsModule.make(settings, ctx) as ChordQuestion;
    expect(q.suffixes).toEqual(SUFFIXES);
    expect(keyboardSuffixes(CHORDS.filter((c) => c.sets.includes('basic')))).toEqual(['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', 'add9', '5']);
  });

  it('Akkordtöne mit Doppel-Vorzeichen: gleiche Tonklasse zählt (Heses = A)', () => {
    const settings = { ...defaultSettings(chordsModule.settings), sets: ['all'] };
    const ctx: MakeContext = { lang: 'de', forced: 'cht:Cdim7', recent: [], stats: {}, now: 0, rng: () => 0.5 };
    const q = chordsModule.make(settings, ctx) as NotesQuestion;
    expect(q.compare).toBe('pc');
    const typed = [
      { letter: 0, acc: 0 },
      { letter: 2, acc: -1 },
      { letter: 4, acc: -1 },
      { letter: 5, acc: 0 },
    ];
    expect(gradeParts(q, typed)).toEqual([true, true, true, true]);
  });

  it('Griffe für den Trainer: Lern-Kennung oder Bibliotheks-Kennung', () => {
    expect(gripById('Fs')).toMatchObject({ symbol: 'F', label: 'F (klein)', shape: 'xx3211' });
    expect(gripById('C#m@x46654')).toMatchObject({ symbol: 'C#m', label: 'C#m', shape: 'x46654' });
    expect(gripById('C@x35553')).toMatchObject({ label: 'C (3. Bund)' });
    expect(gripById('C@x99999')).toBeUndefined();
    expect(gripById(undefined)).toBeUndefined();
  });
});
