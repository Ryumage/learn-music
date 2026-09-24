import type { Lang } from '../music/names';
import { grade, isDue, type ItemStat } from './leitner';

export interface GlobalSettings {
  lang: Lang;
  /** Merkhilfen anzeigen */
  hints: boolean;
  /** Tagesziel in Antworten */
  dailyGoal: number;
  /** Griffbrett: tiefe E-Saite unten (wie Tabs) oder oben (Spieler-Sicht) */
  fretView: 'low-bottom' | 'low-top';
  /** Klang nach dem Prüfen und beim Antippen */
  sound: boolean;
}

export type ModuleSettings = Record<string, string | string[] | boolean>;

export interface SaveData {
  v: 1;
  settings: GlobalSettings;
  modules: Record<string, ModuleSettings>;
  items: Record<string, ItemStat>;
  /** Antworten pro Tag, Schlüssel „YYYY-MM-DD“ (lokal) */
  days: Record<string, number>;
  /** Bestwerte des Akkordwechsel-Trainers */
  best: Record<string, number>;
}

export const STORAGE_KEY = 'saitenlesen';

export const DEFAULT_SETTINGS: GlobalSettings = { lang: 'de', hints: true, dailyGoal: 20, fretView: 'low-bottom', sound: true };

export function emptyData(): SaveData {
  return { v: 1, settings: { ...DEFAULT_SETTINGS }, modules: {}, items: {}, days: {}, best: {} };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function dayKey(now: number): string {
  const d = new Date(now);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Tage in Folge mit mindestens einer Antwort, bis heute oder gestern. */
export function streak(days: Record<string, number>, now: number): number {
  const d = new Date(now);
  if (!days[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
  let count = 0;
  while (days[dayKey(d.getTime())]) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Prüft einen Lernstand (z. B. beim Import); null, wenn er nicht passt. */
export function validateData(json: string | null): SaveData | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObject(raw) || raw.v !== 1) return null;
  const base = emptyData();
  const obj = (x: unknown) => (isObject(x) ? x : {});
  const items: Record<string, ItemStat> = {};
  for (const [k, v] of Object.entries(obj(raw.items))) {
    if (isObject(v) && typeof v.n === 'number' && typeof v.due === 'number') items[k] = v as unknown as ItemStat;
  }
  return {
    v: 1,
    settings: { ...base.settings, ...(obj(raw.settings) as Partial<GlobalSettings>) },
    modules: obj(raw.modules) as Record<string, ModuleSettings>,
    items,
    days: obj(raw.days) as Record<string, number>,
    best: obj(raw.best) as Record<string, number>,
  };
}

/** Liest gespeicherte Daten; Unbekanntes oder Kaputtes ergibt einen leeren Lernstand. */
export function parseData(json: string | null): SaveData {
  return validateData(json) ?? emptyData();
}

export class Store {
  data: SaveData;

  constructor(
    private storage: StorageLike | null,
    private clock: () => number = () => Date.now(),
  ) {
    let json: string | null;
    try {
      json = storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      json = null;
    }
    this.data = parseData(json);
  }

  now(): number {
    return this.clock();
  }

  save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Speicher voll oder gesperrt (privates Surfen): App läuft weiter, nur ohne Speichern.
    }
  }

  get settings(): GlobalSettings {
    return this.data.settings;
  }

  updateSettings(patch: Partial<GlobalSettings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }

  moduleSettings(id: string, defaults: ModuleSettings): ModuleSettings {
    return { ...defaults, ...(this.data.modules[id] ?? {}) };
  }

  setModuleSettings(id: string, settings: ModuleSettings): void {
    this.data.modules[id] = { ...settings };
    this.save();
  }

  stat(key: string): ItemStat | undefined {
    return this.data.items[key];
  }

  /** Speichert den ersten Versuch zu einem Element. */
  record(key: string, correct: boolean, ms: number): void {
    const now = this.now();
    this.data.items[key] = grade(this.data.items[key], correct, ms, now);
    const day = dayKey(now);
    this.data.days[day] = (this.data.days[day] ?? 0) + 1;
    this.save();
  }

  isDue(key: string): boolean {
    const s = this.data.items[key];
    return !!s && isDue(s, this.now());
  }

  /** Kennzahlen über alle Elemente mit einem der Präfixe. */
  summary(prefixes: readonly string[]): { answers: number; correct: number; due: number } {
    const now = this.now();
    let answers = 0;
    let correct = 0;
    let due = 0;
    for (const [key, s] of Object.entries(this.data.items)) {
      if (!prefixes.some((p) => key.startsWith(p))) continue;
      answers += s.n;
      correct += s.c;
      if (isDue(s, now)) due++;
    }
    return { answers, correct, due };
  }

  /** Lernstand als JSON (Export). */
  exportJson(): string {
    return JSON.stringify(this.data, null, 1);
  }

  /** Ersetzt den Lernstand; false, wenn der Text kein gültiger Lernstand ist. */
  importJson(text: string): boolean {
    const data = validateData(text.trim());
    if (!data) return false;
    this.data = data;
    this.save();
    return true;
  }

  /** Löscht den gesamten Lernstand samt Einstellungen. */
  reset(): void {
    this.data = emptyData();
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // nichts zu tun
    }
  }

  /** Gesamtzahl aller Antworten. */
  totalAnswers(): number {
    return Object.values(this.data.days).reduce((a, b) => a + b, 0);
  }

  today(): number {
    return this.data.days[dayKey(this.now())] ?? 0;
  }

  streak(): number {
    return streak(this.data.days, this.now());
  }
}
