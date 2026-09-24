import { samePitchClass, sameSpelling } from '../music/notes';
import type { Lang } from '../music/names';
import type { Answer, ChordAnswer, ModuleDef, NotesAnswer, Question, ShapeAnswer, TapAnswer } from '../modules/types';
import { pitchClass } from '../music/notes';
import type { ModuleSettings, Store } from './store';

/** Wiederholung kommt etwa so viele Fragen später (PLAN 5.2). */
export const RETRY_GAP = 4;

export type Phase = 'answering' | 'wrong' | 'correct' | 'revealed';

export interface Current {
  question: Question;
  isRetry: boolean;
  /** Nummer der regulären Frage (1-basiert); bei Wiederholungen die zuletzt gezeigte */
  number: number;
  attempt: number;
  phase: Phase;
  answer: Answer;
  /** je Teil richtig/falsch nach dem letzten Prüfen */
  parts: boolean[];
  /** Teile, die schon richtig waren und gesperrt bleiben */
  locked: boolean[];
  startedAt: number;
  firstCorrect: boolean | null;
  /** je Teil richtig im ersten Versuch */
  firstParts: boolean[];
  /** Rückmeldung zur falschen Eingabe */
  wrongText: string;
}

export interface Result {
  question: Question;
  isRetry: boolean;
  firstCorrect: boolean;
  partsTotal: number;
  partsCorrect: number;
  /** je Teil richtig im ersten Versuch */
  firstParts: boolean[];
}

export interface SessionOptions {
  lang: Lang;
  /** Elemente in dieser Reihenfolge erzwingen (z. B. „Fehler üben“) */
  forced?: string[];
  rng?: () => number;
}

export function isComplete(q: Question, answer: Answer): boolean {
  if (q.kind === 'choice') return typeof answer === 'number';
  if (q.kind === 'tap') return Array.isArray(answer) && answer.length > 0;
  if (q.kind === 'chord') {
    const a = answer as ChordAnswer | null;
    return !!a?.root && a.suffix !== null;
  }
  if (q.kind === 'shape') return Array.isArray(answer) && (answer as ShapeAnswer).some((f) => f !== null);
  const a = answer as NotesAnswer | null;
  return !!a && q.fields.every((_, i) => !!a[i]);
}

/** Bewertet jeden Teil einzeln. */
export function gradeParts(q: Question, answer: Answer): boolean[] {
  if (q.kind === 'choice') return [answer === q.correct];
  if (q.kind === 'chord') {
    const a = answer as ChordAnswer | null;
    return [!!a?.root && pitchClass(a.root) === pitchClass(q.answer.root) && a.suffix === q.answer.suffix];
  }
  if (q.kind === 'shape') return [q.grade((answer as ShapeAnswer) ?? [])];
  if (q.kind === 'tap') {
    const sel = (answer as TapAnswer | null) ?? [];
    const hit = (p: { string: number; fret: number }) => q.targets.some((t) => t.string === p.string && t.fret === p.fret);
    if (!q.multi) return [sel.length === 1 && hit(sel[0]!)];
    return [sel.length === q.targets.length && sel.every(hit)];
  }
  const a = (answer as NotesAnswer | null) ?? [];
  const same = q.compare === 'exact' ? sameSpelling : samePitchClass;
  if (q.unordered) {
    // jede Eingabe darf jeden noch nicht vergebenen Ton treffen
    const left = q.fields.map((f) => f.answer);
    return a.map((given) => {
      const i = given ? left.findIndex((t) => same(given, t)) : -1;
      if (i < 0) return false;
      left.splice(i, 1);
      return true;
    }).concat(Array(Math.max(0, q.fields.length - a.length)).fill(false)).slice(0, q.fields.length);
  }
  return q.fields.map((f, i) => {
    const given = a[i];
    return !!given && same(given, f.answer);
  });
}

export function emptyAnswer(q: Question): Answer {
  if (q.kind === 'choice') return null;
  if (q.kind === 'tap') return [];
  if (q.kind === 'chord') return { root: null, suffix: null };
  // Griff setzen: alle Saiten leer (○)
  if (q.kind === 'shape') return [0, 0, 0, 0, 0, 0];
  return q.fields.map(() => null);
}

export class Session {
  readonly total: number;
  readonly startedAt: number;
  current: Current | null = null;
  results: Result[] = [];
  private regularAsked = 0;
  private retries: { key: string; at: number }[] = [];
  private recent: string[] = [];
  private forced: string[];
  private rng: () => number;

  constructor(
    readonly module: ModuleDef,
    readonly settings: ModuleSettings,
    private store: Store,
    private opts: SessionOptions,
  ) {
    this.forced = [...(opts.forced ?? [])];
    this.total = opts.forced ? opts.forced.length : module.count(settings);
    this.rng = opts.rng ?? Math.random;
    this.startedAt = store.now();
  }

  get done(): boolean {
    return this.current === null && this.regularAsked >= this.total && this.retries.length === 0;
  }

  private make(forced?: string): Question {
    return this.module.make(this.settings, {
      lang: this.opts.lang,
      forced,
      recent: this.recent,
      stats: this.store.data.items,
      now: this.store.now(),
      rng: this.rng,
      fretView: this.store.settings.fretView,
    });
  }

  /** Nächste Frage; false, wenn die Runde zu Ende ist. */
  next(): boolean {
    let question: Question;
    let isRetry = false;
    const dueRetry = this.retries.findIndex((r) => r.at <= this.regularAsked || this.regularAsked >= this.total);
    if (dueRetry >= 0) {
      const [r] = this.retries.splice(dueRetry, 1);
      question = this.make(r!.key);
      isRetry = true;
    } else if (this.regularAsked < this.total) {
      question = this.make(this.forced.shift());
      this.regularAsked++;
    } else {
      this.current = null;
      return false;
    }
    this.recent = [...this.recent, ...question.items].slice(-4);
    this.current = {
      question,
      isRetry,
      number: this.regularAsked,
      attempt: 0,
      phase: 'answering',
      answer: emptyAnswer(question),
      parts: [],
      locked: question.kind === 'notes' ? question.fields.map(() => false) : [false],
      startedAt: this.store.now(),
      firstCorrect: null,
      firstParts: [],
      wrongText: '',
    };
    return true;
  }

  /** Prüft die aktuelle Antwort. */
  check(): Phase {
    const c = this.current;
    if (!c || c.phase !== 'answering' || !isComplete(c.question, c.answer)) return c?.phase ?? 'answering';
    c.attempt++;
    c.parts = gradeParts(c.question, c.answer);
    const allOk = c.parts.every(Boolean);
    if (c.attempt === 1) {
      this.recordFirst(c, c.parts);
      const retryKey = this.retryKey(c);
      if (!allOk && !c.isRetry && retryKey) {
        this.retries.push({ key: retryKey, at: this.regularAsked + RETRY_GAP - 1 });
      }
    }
    if (allOk) {
      c.phase = 'correct';
    } else {
      c.wrongText = this.describeWrong(c);
      c.phase = c.attempt >= 2 ? 'revealed' : 'wrong';
    }
    if (c.phase !== 'wrong') this.finish(c);
    return c.phase;
  }

  /** „Nochmal“: richtige Teile bleiben gesperrt, falsche werden geleert. */
  retry(): void {
    const c = this.current;
    if (!c || c.phase !== 'wrong') return;
    if (c.question.kind === 'notes') {
      const a = [...(c.answer as NotesAnswer)];
      c.parts.forEach((ok, i) => {
        if (!ok) a[i] = null;
      });
      c.answer = a;
      c.locked = c.parts.map(Boolean);
    } else {
      c.answer = emptyAnswer(c.question);
    }
    c.phase = 'answering';
  }

  /** „Lösung zeigen“ */
  reveal(): void {
    const c = this.current;
    if (!c || (c.phase !== 'wrong' && c.phase !== 'answering')) return;
    if (c.attempt === 0) this.recordFirst(c, gradeParts(c.question, c.answer).map(() => false));
    c.phase = 'revealed';
    this.finish(c);
  }

  /** Wiederholt wird das erste falsche Element (bei Notenzeilen die erste falsche Note). */
  private retryKey(c: Current): string | undefined {
    const q = c.question;
    if (q.kind === 'notes' && q.fieldItems) return q.fieldItems[c.parts.findIndex((ok) => !ok)];
    return q.items[0];
  }

  private recordFirst(c: Current, parts: boolean[]): void {
    c.firstParts = parts;
    c.firstCorrect = parts.every(Boolean);
    const ms = this.store.now() - c.startedAt;
    const q = c.question;
    if (q.kind === 'notes' && q.fieldItems) {
      q.fieldItems.forEach((key, i) => this.store.record(key, parts[i] ?? false, ms));
    } else {
      for (const key of q.items) this.store.record(key, c.firstCorrect, ms);
    }
  }

  private describeWrong(c: Current): string {
    const q = c.question;
    if (q.kind === 'choice') return q.describe && typeof c.answer === 'number' ? q.describe(c.answer) : '';
    if (q.kind === 'tap') return q.describe ? q.describe(c.answer as TapAnswer) : '';
    if (q.kind === 'chord') return q.describe ? q.describe(c.answer as ChordAnswer) : '';
    if (q.kind === 'shape') return q.describe ? q.describe(c.answer as ShapeAnswer) : '';
    if (!q.describe) return '';
    const a = c.answer as NotesAnswer;
    return c.parts
      .map((ok, i) => (ok || !a[i] ? '' : q.describe!(a[i]!, i)))
      .filter(Boolean)
      .join(' ');
  }

  private finish(c: Current): void {
    this.results.push({
      question: c.question,
      isRetry: c.isRetry,
      firstCorrect: c.firstCorrect ?? false,
      partsTotal: c.firstParts.length,
      partsCorrect: c.firstParts.filter(Boolean).length,
      firstParts: c.firstParts,
    });
  }
}
