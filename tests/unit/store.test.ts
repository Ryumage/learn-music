import { describe, expect, it } from 'vitest';
import { dayKey, parseData, Store, streak, STORAGE_KEY, type StorageLike } from '../../src/learn/store';

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

const at = (d: number, h = 12) => new Date(2026, 2, d, h).getTime();

describe('Speicher (PLAN 5.6)', () => {
  it('ein Schlüssel, JSON mit Versionsfeld', () => {
    const mem = new MemoryStorage();
    const store = new Store(mem, () => at(5));
    store.record('str:name:5', true, 1200);
    const raw = JSON.parse(mem.getItem(STORAGE_KEY)!);
    expect(raw.v).toBe(1);
    expect(raw.items['str:name:5'].c).toBe(1);
    expect(raw.days[dayKey(at(5))]).toBe(1);
  });

  it('Einstellungen pro Modul werden gemerkt', () => {
    const mem = new MemoryStorage();
    new Store(mem).setModuleSettings('strings', { count: '10', kinds: ['name'] });
    const again = new Store(mem);
    expect(again.moduleSettings('strings', { count: '20', kinds: ['name', 'num'], extra: true })).toEqual({
      count: '10',
      kinds: ['name'],
      extra: true,
    });
  });

  it('globale Einstellungen', () => {
    const mem = new MemoryStorage();
    new Store(mem).updateSettings({ lang: 'en' });
    expect(new Store(mem).settings).toMatchObject({ lang: 'en', hints: true, dailyGoal: 20 });
  });

  it('kaputte oder fremde Daten führen zu einem leeren Lernstand', () => {
    expect(parseData('{kaputt').v).toBe(1);
    expect(parseData(JSON.stringify({ v: 99, items: { a: 1 } })).items).toEqual({});
    expect(parseData(null).settings.lang).toBe('de');
  });

  it('läuft ohne Speicher weiter', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('gesperrt');
      },
      setItem: () => {
        throw new Error('voll');
      },
      removeItem: () => {},
    };
    const store = new Store(throwing);
    expect(() => store.record('x', true, 1)).not.toThrow();
  });

  it('Kennzahlen pro Modul', () => {
    let now = at(5);
    const store = new Store(new MemoryStorage(), () => now);
    store.record('str:name:5', true, 1000);
    store.record('str:name:4', false, 1000);
    store.record('staff:C4', true, 1000);
    expect(store.summary(['str:'])).toEqual({ answers: 2, correct: 1, due: 1 });
    now = at(6, 4);
    expect(store.summary(['str:']).due).toBe(2);
    expect(store.isDue('str:name:5')).toBe(true);
    expect(store.isDue('str:unbekannt')).toBe(false);
  });

  it('Tage in Folge', () => {
    const days = { [dayKey(at(1))]: 3, [dayKey(at(2))]: 1, [dayKey(at(3))]: 5 };
    expect(streak(days, at(3))).toBe(3);
    expect(streak(days, at(4))).toBe(3); // heute noch nicht geübt
    expect(streak(days, at(5))).toBe(0);
    expect(streak({}, at(5))).toBe(0);
  });
});
