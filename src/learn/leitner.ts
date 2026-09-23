/** Statistik pro Element (eine Note, ein Bund, ein Akkord, eine Wissensfrage). */
export interface ItemStat {
  /** Antworten */
  n: number;
  /** richtig */
  c: number;
  /** falsch */
  w: number;
  /** Leitner-Box 0–5 */
  box: number;
  /** fällig ab (ms) */
  due: number;
  /** letzte Antwortzeit in ms */
  t: number;
  /** Zeitpunkt der letzten Antwort (ms) */
  last: number;
}

/** Fälligkeit in Tagen je Box (PLAN 5.3). */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = BOX_DAYS.length - 1;
const HOUR = 3_600_000;

export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Stichtag: Tagesbeginn + Tage + 3 h, damit „morgen früh“ fällig ist. */
export function dueDate(now: number, days: number): number {
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() + days);
  return d.getTime() + 3 * HOUR;
}

export function isDue(stat: ItemStat | undefined, now: number): boolean {
  return !stat || stat.due <= now;
}

/**
 * Wertet den ersten Versuch einer Frage (PLAN 5.3):
 * - richtig und fällig (oder neu): Box + 1, neue Fälligkeit
 * - richtig, aber nicht fällig: Box bleibt
 * - falsch: Box 0, sofort fällig
 */
export function grade(prev: ItemStat | undefined, correct: boolean, ms: number, now: number): ItemStat {
  const base: ItemStat = prev ? { ...prev } : { n: 0, c: 0, w: 0, box: 0, due: now, t: 0, last: 0 };
  const due = isDue(prev, now);
  base.n += 1;
  base.t = Math.round(ms);
  base.last = now;
  if (correct) {
    base.c += 1;
    if (due) {
      base.box = Math.min(base.box + 1, MAX_BOX);
      base.due = dueDate(now, BOX_DAYS[base.box]!);
    }
  } else {
    base.w += 1;
    base.box = 0;
    base.due = now;
  }
  return base;
}

