import { describe, expect, it } from 'vitest';
import { mnemonicHtml, MNEMONICS, stringsModule } from '../../src/modules/strings';
import { defaultSettings, type MakeContext } from '../../src/modules/types';
import { noteName } from '../../src/music/names';

const ctx = (forced: string, lang: 'de' | 'en' = 'de'): MakeContext => ({
  lang,
  forced,
  recent: [],
  stats: {},
  now: 0,
  rng: () => 0,
});

const settings = defaultSettings(stringsModule.settings);

describe('M1 Saiten', () => {
  it('Default: 20 Fragen, alle Aufgaben', () => {
    expect(stringsModule.count(settings)).toBe(20);
    expect(stringsModule.keys(settings)).toHaveLength(6 * 5 + 2);
  });

  it('Element-Schlüssel str:<typ>:<saite>', () => {
    for (const k of stringsModule.keys(settings)) expect(k).toMatch(/^str:(name|num|tab|dia|staff):[1-6]$|^str:all:(up|down)$/);
  });

  it('„Wie heißt die 5. Saite?“ → A', () => {
    const q = stringsModule.make(settings, ctx('str:name:5'));
    expect(q.prompt).toBe('Wie heißt die 5. Saite?');
    expect(q.kind).toBe('notes');
    if (q.kind === 'notes') expect(noteName(q.fields[0]!.answer, 'de')).toBe('A');
  });

  it('„Welche Nummer hat die G-Saite?“ → 3', () => {
    const q = stringsModule.make(settings, ctx('str:num:3'));
    expect(q.prompt).toBe('Welche Nummer hat die G-Saite?');
    if (q.kind === 'choice') expect(q.options[q.correct]).toBe('3. Saite');
  });

  it('alle Saiten tief → hoch: E A D G H E, Felder 6.–1.', () => {
    const q = stringsModule.make(settings, ctx('str:all:up'));
    if (q.kind !== 'notes') throw new Error();
    expect(q.fields.map((f) => noteName(f.answer, 'de')).join(' ')).toBe('E A D G H E');
    expect(q.fields.map((f) => f.label).join(' ')).toBe('6. 5. 4. 3. 2. 1.');
    expect(q.solution).toBe('E A D G H e');
  });

  it('englisch: H-Saite heißt B-Saite', () => {
    const q = stringsModule.make(settings, ctx('str:num:2', 'en'));
    expect(q.prompt).toBe('Welche Nummer hat die B-Saite?');
  });

  it('Notensystem: Leersaite A liegt auf der 2. Hilfslinie unten', () => {
    const q = stringsModule.make(settings, ctx('str:staff:5'));
    expect(q.explain).toContain('2. Hilfslinie unten');
    if (q.kind === 'choice') expect(q.correct).toBe(4);
  });

  it('falsche Eingabe wird konkret benannt', () => {
    const q = stringsModule.make(settings, ctx('str:name:5'));
    if (q.kind !== 'notes') throw new Error();
    expect(q.describe!({ letter: 2, acc: 0 }, 0)).toBe('Das war E – das ist die 1. oder 6. Saite.');
    expect(q.describe!({ letter: 0, acc: 0 }, 0)).toBe('Das war C – keine Leersaite heißt so.');
  });

  it('nach jeder Antwort eine Eselsbrücke mit hervorgehobenen Anfangsbuchstaben', () => {
    const q = stringsModule.make(settings, ctx('str:tab:2'));
    expect(q.after).toContain('<b>E</b>in <b>A</b>nfänger');
    expect(mnemonicHtml('Emil half')).toBe('<b>E</b>mil <b>h</b>alf');
  });

  it('Eselsbrücken passen zu den Saiten', () => {
    for (const t of MNEMONICS.de.up) expect(t.split(' ').map((w) => w[0]!.toUpperCase()).join('')).toBe('EADGHE');
    for (const t of MNEMONICS.de.down) expect(t.split(' ').map((w) => w[0]!.toUpperCase()).join('')).toBe('EHGDAE');
    for (const t of MNEMONICS.en.up) expect(t.split(' ').map((w) => w[0]!.toUpperCase()).join('')).toBe('EADGBE');
    for (const t of MNEMONICS.en.down) expect(t.split(' ').map((w) => w[0]!.toUpperCase()).join('')).toBe('EBGDAE');
  });

  it('Labels für die Auswertung', () => {
    expect(stringsModule.label('str:num:3', 'de')).toBe('Nummer der G-Saite');
    expect(stringsModule.label('str:all:down', 'de')).toBe('Alle Saiten hoch → tief');
  });
});
