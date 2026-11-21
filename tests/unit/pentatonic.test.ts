import { describe, expect, it } from 'vitest';
import {
  degreeOf,
  minorRoot,
  PATTERN_COUNT,
  patternPositions,
  patternSpan,
  pentaName,
  PENTA_STEPS,
  playOrder,
  positionMidi,
  positionPc,
  scaleNoteName,
  type PentaType,
} from '../../src/music/pentatonic';
import { gradeParts } from '../../src/learn/session';
import { pentaKeys, pentaModule } from '../../src/modules/pentatonic';
import { defaultSettings, type ChoiceQuestion, type MakeContext, type TapQuestion } from '../../src/modules/types';
import { newPentaToolState, renderPentaTool } from '../../src/screens/penta';

const text = (type: PentaType, root: number, n: number) =>
  patternPositions(type, root, n)
    .map((p) => `${p.string}:${p.fret}`)
    .join(' ');

describe('Pentatonik: Patterns', () => {
  it('a-Moll Pattern 1 ist die klassische Box im 5. Bund', () => {
    expect(text('minor', 9, 1)).toBe('6:5 6:8 5:5 5:7 4:5 4:7 3:5 3:7 2:5 2:8 1:5 1:8');
  });

  it('a-Moll Pattern 2–5 schließen lückenlos an', () => {
    expect(text('minor', 9, 2)).toBe('6:8 6:10 5:7 5:10 4:7 4:10 3:7 3:9 2:8 2:10 1:8 1:10');
    expect(text('minor', 9, 5)).toBe('6:3 6:5 5:3 5:5 4:2 4:5 3:2 3:5 2:3 2:5 1:3 1:5');
  });

  it('e-Moll Pattern 1 liegt offen am Sattel', () => {
    expect(text('minor', 4, 1)).toBe('6:0 6:3 5:0 5:2 4:0 4:2 3:0 3:2 2:0 2:3 1:0 1:3');
  });

  it('alle 12 Tonarten × 5 Patterns × Moll/Dur: 2 Töne pro Saite, nur Leitertöne, Grundton enthalten, spielbar', () => {
    for (const type of ['minor', 'major'] as const) {
      for (let root = 0; root < 12; root++) {
        const all = new Set<number>();
        for (let n = 1; n <= PATTERN_COUNT; n++) {
          const ps = patternPositions(type, root, n);
          expect(ps).toHaveLength(12);
          for (const s of [6, 5, 4, 3, 2, 1]) expect(ps.filter((p) => p.string === s)).toHaveLength(2);
          for (const p of ps) {
            expect(degreeOf(type, root, positionPc(p)), `${type} ${root} P${n} ${p.string}:${p.fret}`).not.toBeNull();
            all.add(positionPc(p));
          }
          expect(ps.some((p) => degreeOf(type, root, positionPc(p)) === '1')).toBe(true);
          const [lo, hi] = patternSpan(ps);
          expect(hi - lo).toBeLessThanOrEqual(4);
          expect(lo).toBeGreaterThanOrEqual(0);
          expect(hi).toBeLessThanOrEqual(15);
          // aufsteigend: jede Tonhöhe höher als die vorige
          const midis = ps.map(positionMidi);
          for (let i = 1; i < midis.length; i++) expect(midis[i]!).toBeGreaterThan(midis[i - 1]!);
        }
        expect(all.size).toBe(5);
      }
    }
  });

  it('Dur-Pentatonik nutzt die Patterns der parallelen Moll-Pentatonik', () => {
    expect(minorRoot('major', 0)).toBe(9);
    expect(text('major', 0, 3)).toBe(text('minor', 9, 3));
    expect(PENTA_STEPS.major).toEqual([0, 2, 4, 7, 9]);
  });
});

describe('Pentatonik: Namen und Stufen', () => {
  it('Stufen', () => {
    expect(degreeOf('minor', 9, 0)).toBe('♭3');
    expect(degreeOf('minor', 9, 7)).toBe('♭7');
    expect(degreeOf('major', 0, 9)).toBe('6');
    expect(degreeOf('minor', 9, 1)).toBeNull();
  });

  it('Tonnamen in der Schreibweise der Tonart', () => {
    expect([0, 3, 5, 7, 10].map((s) => scaleNoteName('minor', 9, (9 + s) % 12, 'de'))).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect([0, 3, 5, 7, 10].map((s) => scaleNoteName('minor', 6, (6 + s) % 12, 'de'))).toEqual(['Fis', 'A', 'H', 'Cis', 'E']);
    expect([0, 2, 4, 7, 9].map((s) => scaleNoteName('major', 10, (10 + s) % 12, 'de'))).toEqual(['B', 'C', 'D', 'F', 'G']);
    expect(scaleNoteName('minor', 9, 9, 'en')).toBe('A');
  });

  it('Namen', () => {
    expect(pentaName('minor', 9, 'de')).toBe('a-Moll-Pentatonik');
    expect(pentaName('major', 0, 'de')).toBe('C-Dur-Pentatonik');
    expect(pentaName('minor', 11, 'de')).toBe('h-Moll-Pentatonik');
    expect(pentaName('minor', 11, 'en')).toBe('b-Moll-Pentatonik');
  });

  it('Spielfolge auf- und abwärts', () => {
    const ps = patternPositions('minor', 9, 1);
    const order = playOrder(ps);
    expect(order).toHaveLength(23);
    expect(order[0]).toEqual(ps[0]);
    expect(order[11]).toEqual(ps[11]);
    expect(order[22]).toEqual(ps[0]);
  });
});

describe('Modul Pentatonik', () => {
  const settings = defaultSettings(pentaModule.settings);
  const ctx = (forced: string, seed = 0.4): MakeContext => ({ lang: 'de', forced, recent: [], stats: {}, now: 0, rng: () => seed });

  it('Standard: a-Moll, alle 5 Patterns, drei Aufgaben', () => {
    expect(settings).toMatchObject({ type: 'minor', root: '9', patterns: ['1', '2', '3', '4', '5'] });
    const keys = pentaKeys(settings);
    expect(keys).toHaveLength(15);
    expect(keys).toContain('pnt:minor:9:1');
    expect(pentaKeys({ ...settings, type: 'major', root: '0', patterns: ['2'], tasks: ['which'] })).toEqual(['pnw:major:0:2']);
  });

  it('jede Frage für alle Tonarten lässt sich richtig beantworten', () => {
    for (const type of ['minor', 'major']) {
      for (let root = 0; root < 12; root++) {
        for (const key of pentaKeys({ ...settings, type, root: String(root) })) {
          for (const seed of [0.05, 0.55, 0.95]) {
            const q = pentaModule.make(settings, ctx(key, seed));
            const ans = q.kind === 'tap' ? q.targets : q.kind === 'choice' ? q.correct : null;
            expect(gradeParts(q, ans as never).every(Boolean), key).toBe(true);
            expect(pentaModule.label(key, 'de')).not.toBe(key);
          }
        }
      }
    }
  });

  it('Pattern greifen: alle 12 Töne, Fenster mit einem Bund Luft', () => {
    const q = pentaModule.make(settings, ctx('pnt:minor:9:1')) as TapQuestion;
    expect(q.multi).toBe(true);
    expect(q.targets).toHaveLength(12);
    expect(q.board).toMatchObject({ from: 4, to: 9, strings: [6, 5, 4, 3, 2, 1] });
    expect(q.prompt).toBe('Tippe alle Töne von Pattern 1 der a-Moll-Pentatonik.');
  });

  it('Stufe benennen: Auswahl der fünf Stufen, Rückmeldung mit Ton', () => {
    const q = pentaModule.make(settings, ctx('pnd:minor:9:1', 0.01)) as ChoiceQuestion;
    expect(q.options).toEqual(['1', '♭3', '4', '5', '♭7']);
    // erster Ton des Patterns: tiefe E-Saite, Bund 5 = A = Grundton
    expect(q.options[q.correct]).toBe('1');
    expect(q.describe!(1)).toBe('Stufe ♭3 wäre der Ton C.');
  });

  it('Werkzeug: Zustand mit Standardwerten, gemerkte Auswahl', () => {
    expect(newPentaToolState({})).toMatchObject({ type: 'minor', root: 9, pattern: 0, labels: 'degree', tempo: 90 });
    expect(newPentaToolState({ type: 'major', root: '0', pattern: '3', tempo: '120' })).toMatchObject({ type: 'major', root: 0, pattern: 3, tempo: 120 });
    expect(newPentaToolState({ root: '99', tempo: '7' })).toMatchObject({ root: 9, tempo: 90 });
    const html = renderPentaTool(newPentaToolState({}), 'de', 'low-bottom');
    expect(html).toContain('Pattern 1 von 5');
    expect(html.match(/class="penta-thumb(?: is-on)?"/g)).toHaveLength(5);
    expect(html).toContain('fb-root');
  });
});
