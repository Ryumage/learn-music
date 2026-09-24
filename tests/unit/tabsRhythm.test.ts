import { describe, expect, it } from 'vitest';
import { gradeParts } from '../../src/learn/session';
import { dailyModule } from '../../src/modules/daily';
import { rhythmKeys, rhythmModule } from '../../src/modules/rhythm';
import { CAPO_SHAPES, tabKeys, tabsModule, TECHNIQUES, textTab } from '../../src/modules/tabs';
import { defaultSettings, type ChoiceQuestion, type ChordQuestion, type MakeContext, type NotesQuestion, type Question } from '../../src/modules/types';
import { capoSounding, parseChord } from '../../src/music/chords';
import { pitchClass } from '../../src/music/notes';
import { renderTab } from '../../src/render/tab';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ctx = (forced: string, lang: 'de' | 'en' = 'de', seed = 7): MakeContext => ({ lang, forced, recent: [], stats: {}, now: 0, rng: seeded(seed) });
const tabSettings = defaultSettings(tabsModule.settings);
const rhSettings = defaultSettings(rhythmModule.settings);

function correctAnswer(q: Question): unknown {
  if (q.kind === 'choice') return q.correct;
  if (q.kind === 'chord') return { ...q.answer };
  if (q.kind === 'notes') return q.fields.map((f) => f.answer);
  throw new Error(q.kind);
}

describe('M6 Tabs', () => {
  it('Themen und Schlüssel; H/B-Fragen nur im Deutsch-Modus', () => {
    expect(tabSettings.topics).toEqual(['basics', 'tech', 'chords']);
    const de = tabKeys(tabSettings, 'de');
    const en = tabKeys(tabSettings, 'en');
    expect(de.filter((k) => k.startsWith('tab:hb:'))).toEqual(['tab:hb:Bm', 'tab:hb:B7', 'tab:hb:Bb', 'tab:hb:B']);
    expect(en.some((k) => k.startsWith('tab:hb:'))).toBe(false);
    expect(de.length - en.length).toBe(4);
    for (const t of ['line', 'note', 'know', 'tech', 'arc', 'stack', 'capo', 'cfret', 'head']) expect(en.some((k) => k.startsWith(`tab:${t}:`))).toBe(true);
    expect(tabKeys({ ...tabSettings, topics: ['tech'] }).every((k) => /^tab:(tech|arc):/.test(k))).toBe(true);
  });

  it('Tagesübung: H/B-Fragen sind im Englisch-Modus nicht fällig', () => {
    const store = {
      settings: { lang: 'en' },
      moduleSettings: (_: string, d: unknown) => d,
      isDue: () => true,
    } as never;
    const keys = dailyModule(store, [tabsModule]).keys({});
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.startsWith('tab:hb:'))).toBe(false);
  });

  it('jede Frage lässt sich richtig beantworten', () => {
    for (const key of tabKeys(tabSettings, 'de')) {
      for (const seed of [1, 2, 3]) {
        const q = tabsModule.make(tabSettings, ctx(key, 'de', seed));
        expect(q.items).toEqual([key]);
        expect(gradeParts(q, correctAnswer(q) as never).every(Boolean), key).toBe(true);
        expect(tabsModule.label(key, 'de')).not.toBe(key);
        if (q.kind === 'choice') {
          expect(new Set(q.options).size, key).toBe(q.options.length);
          expect(q.options.length).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it('markierte Tab-Linie → Saite 1–6', () => {
    const q = tabsModule.make(tabSettings, ctx('tab:line:2')) as ChoiceQuestion;
    expect(q.options).toHaveLength(6);
    expect(q.options[q.correct]).toBe('2. Saite (H-Saite)');
  });

  it('Ton im Tab: Tonklasse zählt, Herleitung in der Erklärung', () => {
    const q = tabsModule.make(tabSettings, ctx('tab:note:5')) as NotesQuestion;
    expect(q.compare).toBe('pc');
    expect(q.explain).toMatch(/A-Saite, \d\. Bund|A-Saite leer/);
  });

  it('Spieltechniken: Zeichen und Bedeutung', () => {
    expect(TECHNIQUES.h.sign).toBe('5h7');
    expect(TECHNIQUES.sd.sign).toBe('7\\5');
    expect(TECHNIQUES.br.sign).toBe('7b9r7');
    const q = tabsModule.make(tabSettings, ctx('tab:tech:p')) as ChoiceQuestion;
    expect(q.options[q.correct]).toBe('Pull-off (Abzugbindung)');
    expect(q.figure).toContain('7p5');
    expect(q.explain).toContain('seitlich');
  });

  it('Text-Tab im UG-Stil', () => {
    const lines = textTab({ 3: '5h7--' });
    expect(lines).toHaveLength(6);
    expect(lines[0]).toMatch(/^e\|-+\|$/);
    expect(lines[2]).toBe('G|---5h7-----|');
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });

  it('Bögen: gleich = Haltebogen, höher = Hammer-on, tiefer = Pull-off', () => {
    for (const [t, label] of [
      ['tie', 'Haltebogen (nicht neu anschlagen)'],
      ['h', 'Hammer-on'],
      ['p', 'Pull-off'],
    ]) {
      const q = tabsModule.make(tabSettings, ctx(`tab:arc:${t}`)) as ChoiceQuestion;
      expect(q.options[q.correct]).toBe(label);
      expect(q.figure).toContain('tab-arc');
    }
  });

  it('gestapelte Spalte → Akkord über die Akkordtastatur', () => {
    const q = tabsModule.make(tabSettings, ctx('tab:stack:C')) as ChordQuestion;
    expect(q.kind).toBe('chord');
    expect(q.answer.suffix).toBe('');
    expect(pitchClass(q.answer.root)).toBe(0);
    expect(q.solution).toBe('x32010 = C');
  });

  it('Capo → klingender Akkord, mit Halbtonkette', () => {
    expect(CAPO_SHAPES).toEqual(['G', 'C', 'D', 'Em', 'Am', 'A', 'E', 'Dm']);
    for (let seed = 1; seed < 30; seed++) {
      const q = tabsModule.make(tabSettings, ctx('tab:capo:G', 'de', seed)) as ChordQuestion;
      const capo = Number(/Capo im (\d)\./.exec(q.prompt)![1]);
      expect(capo).toBeGreaterThanOrEqual(1);
      expect(capo).toBeLessThanOrEqual(7);
      const want = parseChord(capoSounding('G', capo));
      expect(pitchClass(q.answer.root)).toBe(pitchClass(want.root));
    }
    const q = tabsModule.make(tabSettings, ctx('tab:capo:G', 'de', 1)) as ChordQuestion;
    expect(q.explain).toContain('G →');
  });

  it('Capo-Bund: Auswahl 1–7', () => {
    const q = tabsModule.make(tabSettings, ctx('tab:cfret:G')) as ChoiceQuestion;
    expect(q.options).toEqual(['1. Bund', '2. Bund', '3. Bund', '4. Bund', '5. Bund', '6. Bund', '7. Bund']);
    const target = /klingt in ([^.]+)\./.exec(q.prompt)![1]!;
    expect(capoSounding('G', q.correct + 1)).toBe(target);
  });

  it('H/B-Fangfragen: Bm = h-Moll, B7 = H7, Bb = B-Dur, B = H-Dur', () => {
    const want = { Bm: 'h-Moll', B7: 'H7', Bb: 'B-Dur', B: 'H-Dur' };
    for (const [sym, spoken] of Object.entries(want)) {
      const q = tabsModule.make(tabSettings, ctx(`tab:hb:${sym}`)) as ChoiceQuestion;
      expect(q.options[q.correct]).toBe(spoken);
    }
    const b7 = tabsModule.make(tabSettings, ctx('tab:hb:B7')) as ChoiceQuestion;
    expect(b7.explain).toContain('H Dis Fis A');
  });

  it('Kopfzeile Tuning: Normalstimmung, deutsch mit H', () => {
    const de = tabsModule.make(tabSettings, ctx('tab:head:tuning')) as ChoiceQuestion;
    expect(de.options[de.correct]).toBe('Normalstimmung (E A D G H E)');
    const en = tabsModule.make(tabSettings, ctx('tab:head:tuning', 'en')) as ChoiceQuestion;
    expect(en.options[en.correct]).toBe('Normalstimmung (E A D G B E)');
  });
});

describe('M7 Rhythmus', () => {
  it('Themen und Schlüssel', () => {
    expect(rhSettings.topics).toEqual(['values', 'count', 'time']);
    const keys = rhythmKeys(rhSettings);
    for (const t of ['val', 'beats', 'fill', 'count', 'strum', 'time', 'tempo']) expect(keys.some((k) => k.startsWith(`rh:${t}:`))).toBe(true);
    expect(keys).not.toContain('rh:fill:whole');
    expect(rhythmKeys({ ...rhSettings, topics: ['time'] }).every((k) => /^rh:(time|tempo):/.test(k))).toBe(true);
  });

  it('jede Frage lässt sich richtig beantworten; Auswahl ohne Dubletten', () => {
    for (const key of rhythmKeys(rhSettings)) {
      for (const seed of [1, 2, 3, 4]) {
        const q = rhythmModule.make(rhSettings, ctx(key, 'de', seed)) as ChoiceQuestion;
        expect(q.kind).toBe('choice');
        expect(q.correct, key).toBeGreaterThanOrEqual(0);
        expect(gradeParts(q, q.correct)).toEqual([true]);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(rhythmModule.label(key, 'de')).not.toBe(key);
      }
    }
  });

  it('Notenwert erkennen: 7 Optionen; Schläge: ¼ ½ 1 1½ 2 3 4', () => {
    const v = rhythmModule.make(rhSettings, ctx('rh:val:dquarter')) as ChoiceQuestion;
    expect(v.options).toEqual(['Ganze', 'Punktierte Halbe', 'Halbe', 'Punktierte Viertel', 'Viertel', 'Achtel', 'Sechzehntel']);
    expect(v.options[v.correct]).toBe('Punktierte Viertel');
    const b = rhythmModule.make(rhSettings, ctx('rh:beats:dhalf')) as ChoiceQuestion;
    expect(b.options).toEqual(['¼', '½', '1', '1½', '2', '3', '4']);
    expect(b.options[b.correct]).toBe('3');
  });

  it('Takt ergänzen: Rechnung in der Erklärung', () => {
    const q = rhythmModule.make(rhSettings, ctx('rh:fill:half')) as ChoiceQuestion;
    expect(q.options[q.correct]).toBe('Halbe');
    expect(q.explain).toContain('fehlen <b>2</b>');
    expect(q.figure).toContain('?');
  });

  it('Zählzeit und Schlagmuster: Lösung zählt vor', () => {
    const c = rhythmModule.make(rhSettings, ctx('rh:count:5')) as ChoiceQuestion;
    expect(c.options[c.correct]).toBe('3 +');
    expect(c.explain).toContain('Gezählt:');
    const s = rhythmModule.make(rhSettings, ctx('rh:strum:3')) as ChoiceQuestion;
    expect(s.options[s.correct]).toBe('2 +');
    expect(s.explain).toContain('Aufschlag ↑');
  });

  it('Taktart und Tempo', () => {
    const t = rhythmModule.make(rhSettings, ctx('rh:time:6/8')) as ChoiceQuestion;
    expect(t.options[t.correct]).toBe('6 Achtel pro Takt, gefühlt 2 × 3');
    expect(t.explain).toContain('1-und-a-2-und-a');
    const beat = rhythmModule.make(rhSettings, ctx('rh:tempo:100:beat')) as ChoiceQuestion;
    expect(beat.options[beat.correct]).toBe('0,6 s');
    const bar = rhythmModule.make(rhSettings, ctx('rh:tempo:100:bar')) as ChoiceQuestion;
    expect(bar.options[bar.correct]).toBe('2,4 s');
  });
});

describe('Tab-Renderer', () => {
  it('Zahlen, gestapelte Spalte, Bogen mit Beschriftung', () => {
    const svg = renderTab({
      columns: [{ notes: [{ string: 3, text: '5' }] }, { notes: [{ string: 3, text: '7' }, { string: 2, text: '8' }] }],
      arcs: [{ string: 3, from: 0, to: 1, label: 'H' }],
      lang: 'de',
      label: 'Test',
    });
    expect(svg.match(/class="tab-num/g)).toHaveLength(3);
    expect(svg).toContain('class="tab-arc"');
    expect(svg).toContain('>H</text>');
  });

  it('Rhythmus: Halbe eingekreist mit kurzem Hals, Achtel mit Balken, Ganze ohne Hals', () => {
    const svg = renderTab({
      columns: [
        { notes: [{ string: 3, text: '2' }], rhythm: 'half' },
        { notes: [{ string: 3, text: '0' }], rhythm: 'eighth' },
        { notes: [{ string: 3, text: '0' }], rhythm: 'eighth' },
        { notes: [{ string: 3, text: '1' }], rhythm: 'quarter' },
      ],
      lang: 'de',
      label: 'Test',
    });
    expect(svg.match(/tab-circle/g)).toHaveLength(1);
    expect(svg.match(/tab-stem/g)).toHaveLength(4);
    expect(svg.match(/tab-beam/g)).toHaveLength(1);
    expect(svg).not.toContain('tab-flag');
    const whole = renderTab({ columns: [{ notes: [{ string: 3, text: '2' }], rhythm: 'whole' }], lang: 'de', label: 'Test' });
    expect(whole).toContain('tab-circle');
    expect(whole).not.toContain('tab-stem');
  });

  it('gesuchter Wert verrät sich nicht (kein Kreis, kein Hals)', () => {
    const svg = renderTab({ columns: [{ notes: [{ string: 3, text: '?' }], rhythm: 'half', hideRhythm: true }, { notes: [{ string: 3, text: '0' }], rhythm: 'half' }], lang: 'de', label: 'Test' });
    expect(svg.match(/tab-circle/g)).toHaveLength(1);
    expect(svg.match(/tab-stem/g)).toHaveLength(1);
  });
});
