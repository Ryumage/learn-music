import { shuffle } from '../learn/picker';
import type { ModuleSettings, Store } from '../learn/store';
import { defaultSettings, type ModuleDef } from './types';

/** Höchstzahl Fragen der Tagesübung (PLAN 5.3). */
export const DAILY_MAX = 20;

function settingsOf(store: Store, mod: ModuleDef): ModuleSettings {
  return store.moduleSettings(mod.id, defaultSettings(mod.settings));
}

/** Fällige Elemente eines Moduls, im Rahmen seiner aktuellen Einstellungen. */
export function moduleDue(store: Store, mod: ModuleDef): string[] {
  return mod.keys(settingsOf(store, mod)).filter((k) => store.isDue(k));
}

/** Anzahl fälliger Elemente über alle Module. */
export function dueCount(store: Store, mods: readonly ModuleDef[]): number {
  return mods.reduce((a, m) => a + moduleDue(store, m).length, 0);
}

/**
 * Fragen der Tagesübung: alle fälligen Elemente aus allen Modulen, gemischt, höchstens 20 Fragen.
 * In M2 werden fällige Noten zu Zeilen gebündelt.
 */
export function dailyQuestions(store: Store, mods: readonly ModuleDef[], rng: () => number = Math.random): string[] {
  const all: string[] = [];
  for (const m of mods) {
    const due = moduleDue(store, m);
    if (!due.length) continue;
    all.push(...(m.groupForced ? m.groupForced(due, settingsOf(store, m)) : due));
  }
  return shuffle(all, rng).slice(0, DAILY_MAX);
}

export function moduleForKey(key: string, mods: readonly ModuleDef[]): ModuleDef | undefined {
  return mods.find((m) => m.prefixes.some((p) => key.startsWith(p)));
}

/** Tagesübung als Modul: leitet jede Frage an das Modul des Elements weiter, mit dessen Einstellungen. */
export function dailyModule(store: Store, mods: readonly ModuleDef[]): ModuleDef {
  return {
    id: 'daily',
    name: 'Tagesübung',
    desc: 'Alle heute fälligen Wiederholungen aus allen Modulen.',
    prefixes: mods.flatMap((m) => m.prefixes),
    settings: [],
    count: () => 0,
    keys: () => mods.flatMap((m) => moduleDue(store, m)),
    make(_settings, ctx) {
      const key = ctx.forced ?? '';
      const mod = moduleForKey(key, mods);
      if (!mod) throw new Error(`Kein Modul für ${key}`);
      return mod.make(settingsOf(store, mod), ctx);
    },
    label(key, lang) {
      return moduleForKey(key, mods)?.label(key, lang) ?? key;
    },
  };
}
