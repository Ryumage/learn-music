import { describe, expect, it } from 'vitest';
import { gradeParts } from '../../src/learn/session';
import type { ModuleSettings } from '../../src/learn/store';
import { fretboardModule, pcAt } from '../../src/modules/fretboard';
import { OCTAVE_MESSAGE, readModule } from '../../src/modules/readFret';
import { defaultSettings, type MakeContext, type TapQuestion } from '../../src/modules/types';
import { fretMidi, type StringNo } from '../../src/music/guitar';
import { fretWindow, renderFretboard } from '../../src/render/fretboard';

function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const ctx = (forced?: string, seed = 1): MakeContext => ({ lang: 'de', forced, recent: [], stats: {}, now: 0, rng: rng(seed) });
const m4 = (extra: ModuleSettings = {}): ModuleSettings => ({ ...defaultSettings(fretboardModule.settings), ...extra });

describe('Griffbrett-Fenster (höchstens 8 Bünde)', () => {
  it('kleine Bereiche ganz', () => {
    expect(fretWindow([0, 4], 3)).toEqual([0, 4]);
    expect(fretWindow([0, 7], 7)).toEqual([0, 7]);
    expect(fretWindow([5, 12], 9)).toEqual([5, 12]);
  });

  it('0–12: Fenster enthält immer die Stelle und hat höchstens 8 Bünde', () => {
    for (let seed = 1; seed < 50; seed++) {
      for (let f = 0; f <= 12; f++) {
        const [a, b] = fretWindow([0, 12], f, rng(seed));
        expect(f).toBeGreaterThanOrEqual(a);
        expect(f).toBeLessThanOrEqual(b);
        expect(b - Math.max(a, 1) + 1).toBeLessThanOrEqual(8);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe('Griffbrett-Zeichnung', () => {
  it('Tippflächen nur auf antippbaren Saiten, andere abgedunkelt', () => {
    const svg = renderFretboard({ from: 0, to: 4, tappable: [5], active: [5], lang: 'de', label: 'x' });
    expect(svg.match(/data-action="tap"/g)).toHaveLength(5);
    expect(svg.match(/fb-veil/g)).toHaveLength(5);
  });

  it('Einlagen bei 3 5 7 9 und doppelt bei 12', () => {
    const svg = renderFretboard({ from: 5, to: 12, lang: 'de', label: 'x' });
    expect(svg.match(/fb-inlay/g)).toHaveLength(3 + 2);
  });
});

describe('M4 Griffbrett', () => {
  it('Defaults: Saiten 6 + 5, Bünde 0–4, ohne Vorzeichen', () => {
    expect(m4()).toMatchObject({ strings: ['6', '5'], frets: '0-4', accidentals: false, points: '1' });
  });

  it('Element-Schlüssel ohne Vorzeichen nur Stammtöne', () => {
    const keys = fretboardModule.keys(m4({ task: 'name' }));
    // E-Saite: E F G (0 1 3) · A-Saite: A H C D (0 2 3 5→nur bis 4: 0 2 3)
    expect(keys.sort()).toEqual(['fret:5:0', 'fret:5:2', 'fret:5:3', 'fret:6:0', 'fret:6:1', 'fret:6:3'].sort());
    expect(fretboardModule.keys(m4({ task: 'name', accidentals: true }))).toHaveLength(10);
  });

  it('Benennen: Vergleich nach Tonklasse, Herleitung in der Erklärung', () => {
    const q = fretboardModule.make(m4({ task: 'name' }), ctx('fret:5:3'));
    if (q.kind !== 'notes') throw new Error();
    expect(q.compare).toBe('pc');
    expect(q.explain).toContain('A-Saite, 3. Bund: A → Ais/B → H → C');
    expect(q.describe!({ letter: 1, acc: 1 }, 0)).toBe('Das war Dis/Es (A-Saite, 6. Bund).');
    expect(q.board!.points).toEqual([{ string: 5, fret: 3 }]);
  });

  it('Benennen mit 2–4 Punkten: jede Saite höchstens einmal, alle im Fenster', () => {
    for (let seed = 1; seed < 40; seed++) {
      const q = fretboardModule.make(m4({ task: 'name', points: '2-4', strings: ['6', '5', '4', '3'], frets: '0-12' }), ctx(undefined, seed));
      if (q.kind !== 'notes') throw new Error();
      const pts = q.board!.points;
      expect(pts.length).toBeGreaterThanOrEqual(2);
      expect(pts.length).toBeLessThanOrEqual(4);
      expect(new Set(pts.map((p) => p.string)).size).toBe(pts.length);
      for (const p of pts) {
        expect(p.fret).toBeGreaterThanOrEqual(q.board!.from);
        expect(p.fret).toBeLessThanOrEqual(q.board!.to);
      }
      expect(q.fieldItems).toHaveLength(pts.length);
    }
  });

  it('Finden: nur die gefragte Saite ist antippbar, jede Stelle mit der Tonklasse zählt', () => {
    const q = fretboardModule.make(m4({ task: 'find', frets: '0-12' }), ctx('find:6:0', 3)) as TapQuestion;
    expect(q.prompt).toBe('Tippe E auf der tiefen E-Saite.');
    expect(q.board.strings).toEqual([6]);
    for (const t of q.targets) expect(pcAt(t.string, t.fret)).toBe(4);
    expect(gradeParts(q, [{ string: 6, fret: 0 }])).toEqual([true]);
    expect(gradeParts(q, [{ string: 6, fret: 1 }])).toEqual([false]);
    expect(q.describe!([{ string: 6, fret: 1 }])).toBe('Das war F (tiefe E-Saite, 1. Bund).');
  });

  it('Alle finden: Menge muss vollständig sein; Rückmeldung zählt Treffer und Fehltipps', () => {
    const q = fretboardModule.make(m4({ task: 'all', strings: ['6', '5', '4'], frets: '0-7' }), ctx('fall:9')) as TapQuestion;
    // A: tiefe E 5, A leer, D 7
    expect(q.targets).toEqual(
      expect.arrayContaining([
        { string: 6, fret: 5 },
        { string: 5, fret: 0 },
        { string: 4, fret: 7 },
      ]),
    );
    expect(q.targets).toHaveLength(3);
    expect(gradeParts(q, q.targets)).toEqual([true]);
    expect(gradeParts(q, q.targets.slice(0, 2))).toEqual([false]);
    expect(q.describe!([...q.targets.slice(0, 2), { string: 6, fret: 1 }])).toBe('2 von 3 gefunden, 1 falsch getippt.');
  });
});

describe('M3 Noten → Griffbrett', () => {
  const s = (level: string) => ({ ...defaultSettings(readModule.settings), level });

  it('Richtig ist jede Stelle mit exakt der klingenden Tonhöhe', () => {
    for (let seed = 1; seed < 30; seed++) {
      const q = readModule.make(s('6'), ctx(undefined, seed)) as TapQuestion;
      const sounding = q.sound![0]![0]!;
      expect(q.targets.length).toBeGreaterThan(0);
      for (const t of q.targets) expect(fretMidi(t.string, t.fret)).toBe(sounding);
      expect(q.board.to - Math.max(q.board.from, 1) + 1).toBeLessThanOrEqual(8);
    }
  });

  it('1. Lage: Bund 0–5; notiertes E4 klingt als D-Saite 2. Bund', () => {
    const q = readModule.make(s('4'), ctx('read:E4')) as TapQuestion;
    expect([q.board.from, q.board.to]).toEqual([0, 5]);
    expect(q.targets).toEqual([{ string: 4, fret: 2 }]);
    expect(q.outside).toContain('A-Saite, 7. Bund');
  });

  it('Oktavfehler bekommt eine eigene Meldung', () => {
    const q = readModule.make(s('4'), ctx('read:E4')) as TapQuestion;
    expect(q.describe!([{ string: 6, fret: 0 }])).toBe(OCTAVE_MESSAGE);
    expect(q.describe!([{ string: 1, fret: 0 }])).toBe(OCTAVE_MESSAGE);
    expect(q.describe!([{ string: 4, fret: 3 }])).toBe('Das war F (D-Saite, 3. Bund).');
  });

  it('Klang ist die klingende Tonhöhe (notiert − 12)', () => {
    const q = readModule.make(s('1'), ctx('read:E5')) as TapQuestion;
    expect(q.sound).toEqual([[64]]);
  });

  it('antippbar sind alle Saiten', () => {
    const q = readModule.make(s('1'), ctx('read:G4')) as TapQuestion;
    expect(q.board.strings).toEqual([6, 5, 4, 3, 2, 1] as StringNo[]);
  });
});
