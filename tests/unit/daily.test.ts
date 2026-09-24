import { describe, expect, it } from 'vitest';
import { Session } from '../../src/learn/session';
import { Store, type StorageLike } from '../../src/learn/store';
import { heatmapData, weakest } from '../../src/learn/stats';
import { MODULES } from '../../src/modules/catalog';
import { DAILY_MAX, dailyModule, dailyQuestions, dueCount, moduleForKey } from '../../src/modules/daily';
import type { ModuleDef } from '../../src/modules/types';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const mods = MODULES.map((m) => m.def).filter(Boolean) as ModuleDef[];
const at = (d: number, h: number) => new Date(2026, 2, d, h).getTime();

function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('Heute fällig und Tageswechsel (PLAN 5.3, MS4)', () => {
  it('richtig beantwortet: heute nicht fällig, morgen ab 3 Uhr fällig', () => {
    let now = at(10, 15);
    const store = new Store(new MemoryStorage(), () => now);
    store.record('str:name:5', true, 1000);
    store.record('staff:G4', true, 1000);
    expect(dueCount(store, mods)).toBe(0);
    now = at(11, 2);
    expect(dueCount(store, mods)).toBe(0);
    now = at(11, 3);
    expect(dueCount(store, mods)).toBe(2);
  });

  it('falsch beantwortet: sofort fällig', () => {
    const store = new Store(new MemoryStorage(), () => at(10, 15));
    store.record('str:name:5', false, 1000);
    expect(dueCount(store, mods)).toBe(1);
  });

  it('zählt nur Elemente im Rahmen der Modul-Einstellungen', () => {
    const store = new Store(new MemoryStorage(), () => at(10, 15));
    // Stufe 1 enthält nur G4 H4 E5; C4 gehört zu höheren Stufen
    store.record('staff:C4', false, 1000);
    store.record('staff:G4', false, 1000);
    expect(dueCount(store, mods)).toBe(1);
    store.setModuleSettings('staff', { level: '4' });
    expect(dueCount(store, mods)).toBe(2);
  });
});

describe('Tagesübung', () => {
  it('höchstens 20 Fragen, gemischt aus allen Modulen, M2-Noten zu Zeilen gebündelt', () => {
    const store = new Store(new MemoryStorage(), () => at(10, 15));
    store.setModuleSettings('staff', { level: '4', perRow: '4' });
    store.setModuleSettings('strings', {});
    for (const k of ['str:name:1', 'str:name:2', 'str:num:3', 'staff:E3', 'staff:F3', 'staff:G3', 'staff:A3', 'staff:B3']) {
      store.record(k, false, 1000);
    }
    const qs = dailyQuestions(store, mods, rng(2));
    expect(qs).toHaveLength(3 + 2); // 3 M1-Fragen, 5 Noten → 2 Zeilen à 4
    expect(qs.filter((q) => q.startsWith('staff:')).map((q) => q.split(',').length).sort()).toEqual([1, 4]);

    for (let f = 0; f <= 12; f++) for (const s of [6, 5]) store.record(`fret:${s}:${f}`, false, 1000);
    store.setModuleSettings('fret', { frets: '0-12', task: 'name', accidentals: true });
    expect(dailyQuestions(store, mods).length).toBe(DAILY_MAX);
  });

  it('leitet jede Frage an das passende Modul weiter', () => {
    const store = new Store(new MemoryStorage(), () => at(10, 15));
    store.record('str:name:5', false, 1000);
    store.record('staff:G4', false, 1000);
    const daily = dailyModule(store, mods);
    const s = new Session(daily, {}, store, { lang: 'de', forced: dailyQuestions(store, mods, rng(1)), rng: rng(1) });
    expect(s.total).toBe(2);
    const prompts: string[] = [];
    while (s.next()) {
      prompts.push(s.current!.question.prompt);
      s.reveal();
    }
    expect(prompts.sort()).toEqual(['Benenne die Noten.', 'Wie heißt die 5. Saite?'].sort());
    expect(moduleForKey('fall:3', mods)?.id).toBe('fret');
    expect(daily.label('read:G4', 'de')).toContain('Griffbrett');
  });
});

describe('Statistik', () => {
  const stat = (n: number, c: number) => ({ n, c, w: n - c, box: 0, due: 0, t: 1000, last: 0 });

  it('Heatmap fasst Benennen und Finden je Stelle zusammen', () => {
    const map = heatmapData({ 'fret:5:3': stat(2, 1), 'find:5:3': stat(3, 3), 'fall:0': stat(4, 4), 'str:name:5': stat(1, 1), 'fret:1:14': stat(1, 0) });
    expect(map.get('5:3')).toEqual({ n: 5, c: 4 });
    expect(map.size).toBe(1);
  });

  it('Schwachstellen: nur mit Fehlern, höchste Fehlerquote zuerst', () => {
    const w = weakest({ a: stat(4, 1), b: stat(2, 2), c: stat(2, 0), d: stat(10, 5), e: stat(1, 0) }, null, 3);
    expect(w.map((x) => x.key)).toEqual(['c', 'e', 'a']);
    expect(weakest({ 'staff:C4': stat(2, 1), 'str:x': stat(2, 0) }, ['staff:']).map((x) => x.key)).toEqual(['staff:C4']);
  });
});

describe('Export, Import, Löschen (PLAN 5.6)', () => {
  it('Rundlauf', () => {
    const a = new Store(new MemoryStorage(), () => at(10, 15));
    a.record('str:name:5', true, 1000);
    a.updateSettings({ lang: 'en' });
    const json = a.exportJson();
    const b = new Store(new MemoryStorage(), () => at(10, 15));
    expect(b.importJson(json)).toBe(true);
    expect(b.data).toEqual(a.data);
    expect(b.settings.lang).toBe('en');
  });

  it('ungültiger Text wird abgelehnt und ändert nichts', () => {
    const store = new Store(new MemoryStorage(), () => at(10, 15));
    store.record('str:name:5', true, 1000);
    for (const bad of ['', 'hallo', '{"v":2}', '[1,2]', 'null']) expect(store.importJson(bad)).toBe(false);
    expect(store.totalAnswers()).toBe(1);
  });

  it('Löschen setzt alles zurück', () => {
    const mem = new MemoryStorage();
    const store = new Store(mem, () => at(10, 15));
    store.record('str:name:5', true, 1000);
    store.reset();
    expect(store.totalAnswers()).toBe(0);
    expect(new Store(mem).totalAnswers()).toBe(0);
  });
});
