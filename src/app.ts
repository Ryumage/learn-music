import { play, playSequence, setSoundEnabled, unlockAudio } from './audio/pluck';
import { createInput, pressAccidental, pressBackspace, pressLetter, selectField, type NoteInput } from './input/noteKeyboard';
import { Session } from './learn/session';
import { Store, type ModuleSettings } from './learn/store';
import { findModule } from './modules/catalog';
import { defaultSettings, type ModuleDef, type NotesAnswer, type TapAnswer } from './modules/types';
import { fretMidi, type StringNo } from './music/guitar';
import { renderHome } from './screens/home';
import { renderQuiz } from './screens/quiz';
import { dueKeys, renderSetup, toggleSetting } from './screens/setup';
import { renderSettings } from './screens/settings';
import { renderSummary, summarize, type SummaryData } from './screens/summary';

export interface AppOptions {
  root: HTMLElement;
  store: Store;
  baseUrl: string;
  showInstallHint: boolean;
}

/** Test-Schnittstelle für E2E: Lösung der aktuellen Frage. */
export interface QuizProbe {
  kind: 'notes' | 'choice' | 'tap';
  phase: string;
  /** tap: richtige Stellen; tappable: antippbare Zellen */
  targets?: { string: number; fret: number }[];
  multi?: boolean;
  /** notes: Tastenfolge je Feld (Buchstabe 0–6, Vorzeichen); choice: richtige Option */
  fields?: { letter: number; acc: number }[];
  correct?: number;
  options?: number;
}

export class App {
  private session: Session | null = null;
  private input: NoteInput | null = null;
  private confirmAbort = false;
  private summary: SummaryData | null = null;
  private lastModule: ModuleDef | null = null;

  constructor(private o: AppOptions) {
    setSoundEnabled(o.store.settings.sound);
    o.root.addEventListener('click', (e) => this.onClick(e));
    // iOS startet Audio nur aus einer Nutzeraktion heraus
    o.root.addEventListener('pointerdown', () => unlockAudio(), { passive: true });
    window.addEventListener('hashchange', () => this.render());
    window.addEventListener('keydown', (e) => this.onKey(e));
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth || this.route().name !== 'quiz') return;
      lastWidth = window.innerWidth;
      this.render();
    });
  }

  /** Breite für Grafiken: Inhaltsbreite ohne Seitenränder und Rahmen der Grafik. */
  private figureWidth(): number {
    const content = Math.min(document.documentElement.clientWidth || window.innerWidth, 640);
    return content - 2 * 16 - 2 * 6 - 2;
  }

  get store(): Store {
    return this.o.store;
  }

  private route(): { name: string; id?: string } {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, id] = h.split('/');
    if (name === 'm' && id) return { name: 'setup', id };
    if (name === 'quiz' || name === 'summary' || name === 'settings') return { name };
    return { name: 'home' };
  }

  private go(hash: string): void {
    // location.hash ändert sich sofort; das folgende hashchange zeichnet nur noch einmal nach.
    if (location.hash !== hash) location.hash = hash;
    this.render();
  }

  private moduleSettings(mod: ModuleDef): ModuleSettings {
    return this.store.moduleSettings(mod.id, defaultSettings(mod.settings));
  }

  render(): void {
    const r = this.route();
    const root = this.o.root;
    const lang = this.store.settings.lang;
    if (r.name === 'setup') {
      const mod = findModule(r.id!)?.def;
      if (!mod) return this.go('#/');
      root.innerHTML = renderSetup(mod, this.moduleSettings(mod), this.store, lang);
    } else if (r.name === 'quiz') {
      if (!this.session?.current) return this.go('#/');
      root.innerHTML = renderQuiz({
        session: this.session,
        input: this.input,
        lang,
        hints: this.store.settings.hints,
        confirmAbort: this.confirmAbort,
        width: this.figureWidth(),
        fretView: this.store.settings.fretView,
        sound: this.store.settings.sound,
      });
    } else if (r.name === 'summary') {
      if (!this.session || !this.summary) return this.go('#/');
      root.innerHTML = renderSummary(this.summary, this.store.streak());
    } else if (r.name === 'settings') {
      root.innerHTML = renderSettings(this.store.settings);
    } else {
      root.innerHTML = renderHome({ showInstallHint: this.o.showInstallHint, baseUrl: this.o.baseUrl, store: this.store });
    }
    document.documentElement.lang = 'de';
  }

  private start(mod: ModuleDef, forced?: string[]): void {
    this.lastModule = mod;
    this.session = new Session(mod, this.moduleSettings(mod), this.store, { lang: this.store.settings.lang, forced });
    this.summary = null;
    this.confirmAbort = false;
    this.nextQuestion(true);
  }

  private nextQuestion(first = false): void {
    const s = this.session!;
    if (!s.next()) {
      this.summary = summarize(s, this.store.now());
      this.go('#/summary');
      return;
    }
    const c = s.current!;
    this.input = c.question.kind === 'notes' ? createInput(c.answer as NotesAnswer, c.locked) : null;
    if (first) this.go('#/quiz');
    else this.render();
    window.scrollTo(0, 0);
  }

  private syncAnswer(): void {
    const c = this.session?.current;
    if (c && this.input) c.answer = [...this.input.answer];
  }

  private check(): void {
    const s = this.session;
    if (!s?.current || s.current.phase !== 'answering') return;
    this.syncAnswer();
    const phase = s.check();
    if (phase === 'correct' || phase === 'revealed') this.playQuestion();
    this.render();
  }

  /** Klang der aktuellen Frage (klingende Tonhöhe). */
  private playQuestion(): void {
    const q = this.session?.current?.question;
    if (!q?.sound?.length || !this.store.settings.sound) return;
    if (q.sound.length === 1) play(q.sound[0]!);
    else playSequence(q.sound);
  }

  private mainAction(): void {
    const c = this.session?.current;
    if (!c) return;
    if (c.phase === 'answering') this.check();
    else if (c.phase === 'wrong') this.retry();
    else this.nextQuestion();
  }

  private retry(): void {
    const s = this.session!;
    s.retry();
    const c = s.current!;
    if (c.question.kind === 'notes') this.input = createInput(c.answer as NotesAnswer, c.locked);
    this.render();
  }

  private onClick(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const a = el.dataset.action!;
    const r = this.route();
    const c = this.session?.current;

    switch (a) {
      case 'setting': {
        const mod = findModule(r.id ?? '')?.def;
        if (!mod) return;
        const def = mod.settings.find((d) => d.id === el.dataset.setting);
        if (!def) return;
        this.store.setModuleSettings(mod.id, toggleSetting(def, this.moduleSettings(mod), el.dataset.value));
        return this.render();
      }
      case 'global': {
        const id = el.dataset.setting!;
        const v = el.dataset.value!;
        if (id === 'lang') this.store.updateSettings({ lang: v === 'en' ? 'en' : 'de' });
        if (id === 'hints') this.store.updateSettings({ hints: v === 'on' });
        if (id === 'dailyGoal') this.store.updateSettings({ dailyGoal: Number(v) });
        if (id === 'fretView') this.store.updateSettings({ fretView: v === 'low-top' ? 'low-top' : 'low-bottom' });
        if (id === 'sound') {
          this.store.updateSettings({ sound: v === 'on' });
          setSoundEnabled(v === 'on');
        }
        return this.render();
      }
      case 'start':
      case 'start-due': {
        const mod = findModule(r.id ?? '')?.def;
        if (!mod) return;
        const settings = this.moduleSettings(mod);
        let forced: string[] | undefined;
        if (a === 'start-due') {
          const due = dueKeys(mod, settings, this.store);
          forced = (mod.groupForced ? mod.groupForced(due, settings) : due).slice(0, mod.count(settings));
        }
        return this.start(mod, forced);
      }
      case 'letter':
        if (!this.input) return;
        this.input = pressLetter(this.input, Number(el.dataset.letter));
        break;
      case 'acc':
        if (!this.input) return;
        this.input = pressAccidental(this.input, Number(el.dataset.acc) as 1 | -1);
        break;
      case 'backspace':
        if (!this.input) return;
        this.input = pressBackspace(this.input);
        break;
      case 'field': {
        if (!this.input || !c) return;
        const i = Number(el.dataset.field);
        // nach dem Prüfen: Note antippen spielt sie ab
        if (c.phase !== 'answering') {
          const m = c.question.kind === 'notes' ? c.question.fieldSounds?.[i] : undefined;
          if (m !== undefined && this.store.settings.sound) play([m]);
          return;
        }
        this.input = selectField(this.input, i);
        break;
      }
      case 'tap': {
        if (!c || c.question.kind !== 'tap' || c.phase !== 'answering') return;
        const pos = { string: Number(el.dataset.string) as StringNo, fret: Number(el.dataset.fret) };
        const sel = (c.answer as TapAnswer) ?? [];
        const has = sel.some((p) => p.string === pos.string && p.fret === pos.fret);
        if (c.question.multi) c.answer = has ? sel.filter((p) => !(p.string === pos.string && p.fret === pos.fret)) : [...sel, pos];
        else c.answer = [pos];
        if (this.store.settings.sound && !has) play([fretMidi(pos.string, pos.fret)]);
        return this.render();
      }
      case 'listen':
        return this.playQuestion();
      case 'sound-test':
        setSoundEnabled(true);
        play([40, 45, 50, 55, 59, 64], 0, 0.06);
        setSoundEnabled(this.store.settings.sound);
        return;
      case 'choice':
        if (!c || c.phase !== 'answering') return;
        c.answer = Number(el.dataset.choice);
        return this.render();
      case 'check':
        return this.check();
      case 'retry':
        return this.retry();
      case 'reveal':
        this.syncAnswer();
        this.session?.reveal();
        this.playQuestion();
        return this.render();
      case 'next':
        return this.nextQuestion();
      case 'abort':
        this.confirmAbort = true;
        return this.render();
      case 'abort-cancel':
        this.confirmAbort = false;
        return this.render();
      case 'abort-confirm': {
        const id = this.session?.module.id;
        this.session = null;
        this.confirmAbort = false;
        return this.go(id ? `#/m/${id}` : '#/');
      }
      case 'restart':
        if (this.lastModule) this.start(this.lastModule);
        return;
      case 'practice-mistakes':
        if (this.lastModule && this.summary) this.start(this.lastModule, this.summary.mistakes.map((m) => m.key));
        return;
      default:
        return;
    }
    this.syncAnswer();
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    if (this.route().name !== 'quiz' || !this.session?.current || e.metaKey || e.ctrlKey || e.altKey) return;
    const c = this.session.current;
    if (this.confirmAbort) {
      if (e.key === 'Escape') {
        this.confirmAbort = false;
        this.render();
      }
      return;
    }
    if (e.key === 'Enter') {
      // Buttons mit Fokus lösen Enter selbst aus
      if ((e.target as HTMLElement).closest('button, a')) return;
      e.preventDefault();
      return this.mainAction();
    }
    if (c.phase !== 'answering') return;
    const q = c.question;
    if (q.kind === 'choice') {
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) {
        c.answer = n - 1;
        this.render();
      }
      return;
    }
    if (!this.input || q.kind !== 'notes') return;
    const key = e.key.toLowerCase();
    const lang = this.store.settings.lang;
    const letters: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, h: 6 };
    if (key in letters) this.input = pressLetter(this.input, letters[key]!);
    else if (key === 'b') this.input = lang === 'de' ? pressLetter(this.input, 6, q.accidentals ? -1 : 0) : pressLetter(this.input, 6);
    else if ((key === '#' || key === '+') && q.accidentals) this.input = pressAccidental(this.input, 1);
    else if (key === '-' && q.accidentals) this.input = pressAccidental(this.input, -1);
    else if (key === 'backspace') this.input = pressBackspace(this.input);
    else return;
    e.preventDefault();
    this.syncAnswer();
    this.render();
  }

  /** Für E2E-Tests: Lösung der aktuellen Frage. */
  probe(): QuizProbe | null {
    const c = this.session?.current;
    if (!c) return null;
    const q = c.question;
    if (q.kind === 'choice') return { kind: 'choice', phase: c.phase, correct: q.correct, options: q.options.length };
    if (q.kind === 'tap') return { kind: 'tap', phase: c.phase, targets: q.targets.map((t) => ({ ...t })), multi: q.multi };
    return { kind: 'notes', phase: c.phase, fields: q.fields.map((f) => ({ letter: f.answer.letter, acc: f.answer.acc })) };
  }
}
