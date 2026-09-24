import { describe, expect, it } from 'vitest';
import { playable } from '../../src/music/guitar';
import { noteName } from '../../src/music/names';
import { diatonic, noteKey, parseNote, soundingMidi } from '../../src/music/notes';
import { buildChord, chordOk, level, LEVELS, noteSolution, staffModule } from '../../src/modules/staffReading';
import { defaultSettings, type MakeContext } from '../../src/modules/types';
import { columnsPerSystem, splitSystems } from '../../src/screens/staffRow';

function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const ctx = (seed = 1, forced?: string): MakeContext => ({ lang: 'de', forced, recent: [], stats: {}, now: 0, rng: rng(seed) });
const keys = (id: number) => LEVELS[id - 1]!.notes.map(noteKey).join(' ');

describe('M2 Stufen (PLAN M2)', () => {
  it('Stufe 1: Leersaiten G, H, E', () => {
    expect(keys(1)).toBe('G4 B4 E5');
  });

  it('Stufe 2: Saiten 1–2', () => {
    expect(keys(2)).toBe('G4 B4 C5 D5 E5 F5 G5');
  });

  it('Stufe 3: G4 … G5 Stammtöne', () => {
    expect(keys(3)).toBe('G4 A4 B4 C5 D5 E5 F5 G5');
  });

  it('Stufe 4: E3 … G5 Stammtöne', () => {
    expect(LEVELS[3]!.notes[0]).toEqual(parseNote('E3'));
    expect(LEVELS[3]!.notes).toHaveLength(17);
  });

  it('Stufe 5: MIDI 52–80 chromatisch, schwarze Tasten als ♯ und ♭', () => {
    const n = LEVELS[4]!.notes;
    expect(n.map(noteKey)).toContain('F#3');
    expect(n.map(noteKey)).toContain('Gb3');
    expect(n.map(noteKey)).toContain('Ab5');
    expect(n.map(noteKey)).not.toContain('A5');
    // 29 Halbtöne, davon 12 schwarze Tasten doppelt
    expect(n).toHaveLength(29 + 12);
    expect(LEVELS[4]!.accidentals).toBe(true);
  });

  it('Stufe 6: bis E6, Stufe 7: bis MIDI 88', () => {
    expect(noteKey(LEVELS[5]!.notes.at(-1)!)).toBe('E6');
    expect(LEVELS[5]!.maxFret).toBe(12);
    expect(noteKey(LEVELS[6]!.notes.at(-1)!)).toBe('E6');
  });

  it('alle Töne jeder Stufe sind im Bundbereich greifbar', () => {
    for (const lv of LEVELS) for (const n of lv.notes) expect(playable([soundingMidi(n)], lv.maxFret), noteKey(n)).not.toBeNull();
  });

  it('Stufenbeschriftung im Englisch-Modus mit B statt H', () => {
    const opt = staffModule.settings.find((s) => s.id === 'level')!.options![0]!;
    expect(opt.label).toContain('H');
    expect(opt.labelEn).toContain('B');
  });
});

describe('M2 Mehrklänge', () => {
  it('mindestens eine Terz, höchstens eine Dezime Abstand', () => {
    expect(chordOk([parseNote('C5'), parseNote('E5')], 4)).toBe(true);
    expect(chordOk([parseNote('C5'), parseNote('D5')], 4)).toBe(false);
    expect(chordOk([parseNote('G3'), parseNote('B4')], 4)).toBe(true); // Dezime
    expect(chordOk([parseNote('G3'), parseNote('C5')], 4)).toBe(false); // Undezime
    expect(chordOk([parseNote('E3'), parseNote('G5')], 4)).toBe(false);
  });

  it('Vorzeichen mindestens eine Sexte auseinander', () => {
    expect(chordOk([parseNote('F#4'), parseNote('Bb4')], 4)).toBe(false);
    expect(chordOk([parseNote('F#4'), parseNote('D5')], 4)).toBe(true);
  });

  it('muss greifbar sein', () => {
    // F3 (tiefe E-Saite, 1. Bund) und A3 (A-Saite leer)
    expect(chordOk([parseNote('F3'), parseNote('A3')], 4)).toBe(true);
    // E3 und G3 liegen in der 1. Lage beide nur auf der tiefen E-Saite
    expect(chordOk([parseNote('E3'), parseNote('G3')], 4)).toBe(false);
  });

  it('baut greifbare Zwei- und Dreiklänge', () => {
    const r = rng(5);
    const lv = LEVELS[3]!;
    let built = 0;
    for (let i = 0; i < 200; i++) {
      const base = lv.notes[Math.floor(r() * lv.notes.length)]!;
      const chord = buildChord(base, 3, lv.notes, lv.maxFret, r);
      if (!chord) continue;
      built++;
      expect(chordOk(chord, lv.maxFret)).toBe(true);
      expect(chord).toContain(base);
    }
    expect(built).toBeGreaterThan(50);
  });
});

describe('M2 Notenzeilen', () => {
  const settings = { ...defaultSettings(staffModule.settings), level: '4' };

  it('Default: 5 Zeilen à 8 Noten, Stufe 1, übereinander an', () => {
    const d = defaultSettings(staffModule.settings);
    expect(d).toMatchObject({ level: '1', perRow: '8', stacked: true, order: 'random', count: '5' });
    expect(staffModule.count(d)).toBe(5);
  });

  it('Zeilen haben die gewählte Länge, Töne aus der Stufe, Mehrklänge von oben nach unten', () => {
    let stacks = 0;
    for (let seed = 1; seed < 60; seed++) {
      const q = staffModule.make(settings, ctx(seed));
      if (q.kind !== 'notes' || !q.staff) throw new Error();
      expect(q.staff.columns).toHaveLength(8);
      const pool = new Set(level(settings).notes.map(noteKey));
      for (const col of q.staff.columns) {
        for (const n of col) expect(pool.has(noteKey(n))).toBe(true);
        for (let i = 1; i < col.length; i++) expect(diatonic(col[i - 1]!)).toBeGreaterThan(diatonic(col[i]!));
        if (col.length > 1) {
          stacks++;
          expect(chordOk(col, 4)).toBe(true);
          expect(col.length).toBeLessThanOrEqual(3);
        }
      }
      // Felder: Spalte für Spalte, in der Spalte von oben nach unten
      const flat = q.staff.columns.flat();
      expect(q.fields.map((f) => f.answer)).toEqual(flat.map((n) => ({ letter: n.letter, acc: n.acc })));
      expect(q.staff.fields.flat()).toEqual(flat.map((_, i) => i));
      expect(q.fieldItems).toEqual(flat.map((n) => `staff:${noteKey(n)}`));
      expect(q.compare).toBe('exact');
    }
    expect(stacks).toBeGreaterThan(40);
  });

  it('Stufe 1–2 und „übereinander aus“: nur Einzelnoten', () => {
    for (const s of [{ ...settings, level: '2' }, { ...settings, stacked: false }]) {
      for (let seed = 1; seed < 30; seed++) {
        const q = staffModule.make(s, ctx(seed));
        if (q.kind === 'notes') expect(q.staff!.columns.every((c) => c.length === 1)).toBe(true);
      }
    }
  });

  it('Melodie: kleine Schritte zwischen den Grundtönen', () => {
    const s = { ...settings, stacked: false, order: 'melody' };
    for (let seed = 1; seed < 30; seed++) {
      const q = staffModule.make(s, ctx(seed));
      if (q.kind !== 'notes') throw new Error();
      const d = q.staff!.columns.map((c) => diatonic(c[0]!));
      for (let i = 1; i < d.length; i++) expect(Math.abs(d[i]! - d[i - 1]!)).toBeLessThanOrEqual(2);
    }
  });

  it('keine direkte Wiederholung derselben Note', () => {
    const s = { ...settings, stacked: false };
    let repeats = 0;
    let total = 0;
    for (let seed = 1; seed < 40; seed++) {
      const q = staffModule.make(s, ctx(seed));
      const cols = q.kind === 'notes' ? q.staff!.columns : [];
      for (let i = 1; i < cols.length; i++, total++) if (noteKey(cols[i]![0]!) === noteKey(cols[i - 1]![0]!)) repeats++;
    }
    expect(repeats / total).toBeLessThan(0.03);
  });

  it('erzwungene Noten kommen in der Zeile vor („Wiederholung“, fällige Noten)', () => {
    const q = staffModule.make(settings, ctx(3, 'staff:E3,staff:C4'));
    if (q.kind !== 'notes') throw new Error();
    expect(q.fieldItems).toContain('staff:E3');
    expect(q.fieldItems).toContain('staff:C4');
  });

  it('fällige Noten werden zu Zeilen gebündelt', () => {
    const due = Array.from({ length: 10 }, (_, i) => `staff:k${i}`);
    expect(staffModule.groupForced!(due, { perRow: '8' })).toEqual([due.slice(0, 8).join(','), due.slice(8).join(',')]);
  });

  it('Stufe mit Vorzeichen zeigt die Vorzeichentasten', () => {
    const q = staffModule.make({ ...settings, level: '5' }, ctx(1));
    expect(q.kind === 'notes' && q.accidentals).toBe(true);
    const q1 = staffModule.make({ ...settings, level: '1' }, ctx(1));
    expect(q1.kind === 'notes' && q1.accidentals).toBe(false);
  });

  it('Lösung je Note: Name · Lage · wo auf der Gitarre', () => {
    expect(noteSolution(parseNote('A3'), 'de', 4)).toBe('A · 2. Hilfslinie unten · A-Saite leer');
    expect(noteSolution(parseNote('B4'), 'de', 4)).toBe('H · 3. Linie · H-Saite leer');
    expect(noteSolution(parseNote('Bb4'), 'en', 4)).toBe('B♭ · 3. Linie · G-Saite, 3. Bund');
    expect(noteSolution(parseNote('A5'), 'de', 12)).toBe('A · 1. Hilfslinie oben · hohe E-Saite, 5. Bund');
    expect(staffModule.label('staff:C4', 'de')).toBe('C · 1. Hilfslinie unten');
    expect(noteName(parseNote('F#4'), 'de')).toBe('Fis');
  });
});

describe('Zeilenumbruch', () => {
  it('8 Noten passen bei 375 px Bildschirmbreite in eine Zeile (Linienabstand ≥ 9,5 px)', () => {
    // 375 − 2·16 Seitenrand − 2·6 Innenabstand − 2 Rahmen
    expect(columnsPerSystem(375 - 46)).toBeGreaterThanOrEqual(8);
    expect(columnsPerSystem(320 - 46)).toBeGreaterThanOrEqual(4);
  });

  it('verteilt gleichmäßig auf Systeme', () => {
    expect(splitSystems(8, 8)).toEqual([8]);
    expect(splitSystems(16, 8)).toEqual([8, 8]);
    expect(splitSystems(12, 8)).toEqual([6, 6]);
    expect(splitSystems(12, 16)).toEqual([12]);
    expect(splitSystems(16, 7)).toEqual([6, 6, 4]);
  });
});
