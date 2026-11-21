import { describe, expect, it } from 'vitest';
import { gradeParts } from '../../src/learn/session';
import { powerFingers, powerKeys, powerModule, powerOk, powerShape, powerSymbol } from '../../src/modules/powerchords';
import { defaultSettings, type ChoiceQuestion, type MakeContext, type NotesQuestion, type ShapeQuestion, type TapQuestion } from '../../src/modules/types';
import { checkShape, parseChord, parseShape, shapeText } from '../../src/music/chords';
import { libraryChord } from '../../src/music/chordLibrary';

const settings = defaultSettings(powerModule.settings);
const ctx = (forced: string, seed = 0.3): MakeContext => ({ lang: 'de', forced, recent: [], stats: {}, now: 0, rng: () => seed });

describe('Powerchords: Griffe', () => {
  it('Form je Grundton-Saite: E/A +2/+2, D mit Oktave +3 auf der H-Saite', () => {
    expect(shapeText(powerShape(6, 3))).toBe('355xxx');
    expect(shapeText(powerShape(5, 3))).toBe('x355xx');
    expect(shapeText(powerShape(4, 3))).toBe('xx356x');
    expect(shapeText(powerShape(6, 0))).toBe('022xxx');
    expect(powerFingers(6, 3)).toBe('134xxx');
    expect(powerFingers(5, 0)).toBe('x013xx');
  });

  it('Namen wie auf Ultimate Guitar', () => {
    expect(powerSymbol(6, 3)).toBe('G5');
    expect(powerSymbol(5, 3)).toBe('C5');
    expect(powerSymbol(4, 3)).toBe('F5');
    expect(powerSymbol(6, 2)).toBe('F#5');
    expect(powerSymbol(5, 1)).toBe('Bb5');
  });

  it('jeder Griff von Bund 0 bis 12 ist Grundton + Quinte (+ Oktave), Grundton im Bass', () => {
    for (const s of [6, 5, 4] as const) {
      for (let f = 0; f <= 12; f++) {
        const r = checkShape(powerShape(s, f), parseChord(powerSymbol(s, f)));
        expect(r.ok, `${s}/${f}`).toBe(true);
        expect(r.inversion).toBe(false);
        expect(powerOk(powerShape(s, f), s, powerSymbol(s, f))).toBe(true);
      }
    }
  });

  it('die Griffe stehen auch in der Akkord-Bibliothek (Typ 5)', () => {
    expect(libraryChord('G5')!.voicings.map((v) => v.shape)).toContain('355xxx');
    expect(libraryChord('C5')!.voicings.map((v) => v.shape)).toContain('x355xx');
  });

  it('Prüfung: zwei Saiten reichen, falsche Saite oder Terz nicht', () => {
    expect(powerOk(parseShape('35xxxx'), 6, 'G5')).toBe(true);
    expect(powerOk(parseShape('x355xx'), 6, 'C5')).toBe(false); // falsche Grundton-Saite
    expect(powerOk(parseShape('325xxx'), 6, 'G5')).toBe(false); // Terz H statt Quinte
    expect(powerOk(parseShape('3xxxxx'), 6, 'G5')).toBe(false); // nur ein Ton
    expect(powerOk(parseShape('x55xxx'), 6, 'D5')).toBe(false); // Grundton nicht auf der E-Saite
  });
});

describe('Powerchords: Modul', () => {
  it('Schlüssel: Standard E- und A-Saite, Bund 0–7, nur Stammtöne; Wissen', () => {
    const keys = powerKeys(settings);
    expect(keys).toContain('pwn:6:3');
    expect(keys).toContain('pws:5:0');
    expect(keys).toContain('pwf:6:7');
    expect(keys).not.toContain('pwn:6:2'); // F#
    expect(keys).not.toContain('pwn:4:3'); // D-Saite nicht gewählt
    expect(keys.filter((k) => k.startsWith('pwk:'))).toHaveLength(9);
    const withAll = powerKeys({ ...settings, strings: ['6', '5', '4'], accidentals: true, frets: '0-12' });
    expect(withAll.filter((k) => k.startsWith('pwn:'))).toHaveLength(3 * 13);
  });

  it('jede Frage lässt sich richtig beantworten', () => {
    const all = powerKeys({ ...settings, strings: ['6', '5', '4'], accidentals: true, frets: '0-12' });
    for (const key of all) {
      for (const seed of [0.1, 0.7]) {
        const q = powerModule.make({ ...settings, strings: ['6', '5', '4'], accidentals: true, frets: '0-12' }, ctx(key, seed));
        expect(q.items).toEqual([key]);
        const answer =
          q.kind === 'choice' ? q.correct : q.kind === 'notes' ? q.fields.map((f) => f.answer) : q.kind === 'shape' ? q.solutionShape : (q as TapQuestion).targets.slice(0, 1);
        expect(gradeParts(q, answer as never).every(Boolean), key).toBe(true);
        expect(powerModule.label(key, 'de')).not.toBe(key);
      }
    }
  });

  it('Erkennen: Grundton zählt, Rückmeldung nennt den getippten Powerchord', () => {
    const q = powerModule.make(settings, ctx('pwn:6:3')) as NotesQuestion;
    expect(q.prompt).toMatch(/Powerchord/);
    expect(q.solution).toBe('355xxx = G5');
    expect(q.describe!({ letter: 0, acc: 0 }, 0)).toContain('Das wäre C5');
  });

  it('Griff setzen: Hinweise bei typischen Fehlern', () => {
    const q = powerModule.make(settings, ctx('pws:6:3')) as ShapeQuestion;
    expect(q.prompt).toBe('Setze G5 mit Grundton auf der tiefen E-Saite.');
    expect(q.describe!(parseShape('x355xx'))).toContain('tiefe E-Saite');
    expect(q.describe!(parseShape('325xxx'))).toContain('Gehört nicht dazu: H');
    expect(q.noteOk!(parseShape('35xxxx'))).toContain('Oktave');
    expect(q.noteOk!(parseShape('355xxx'))).toBe('');
  });

  it('Grundton finden: nur die gewählte Saite antippbar', () => {
    const q = powerModule.make(settings, ctx('pwf:5:5')) as TapQuestion;
    expect(q.board.strings).toEqual([5]);
    expect(q.targets).toContainEqual({ string: 5, fret: 5 });
    expect(q.prompt).toContain('D5');
  });

  it('Wissen: keine Terz, Palm Mute, Drop D', () => {
    const q = powerModule.make(settings, ctx('pwk:majmin')) as ChoiceQuestion;
    expect(q.options[q.correct]).toBe('Weder noch – die Terz fehlt');
    expect(new Set(q.options).size).toBe(4);
  });

  it('Einführung zeigt Griffe und ein Riff zum Anhören', () => {
    const html = powerModule.intro!('de');
    expect(html).toContain('Grundton und Quinte');
    expect(html).toContain('data-action="play-seq"');
    expect(html.match(/class="pw-shape"/g)).toHaveLength(3);
  });
});
