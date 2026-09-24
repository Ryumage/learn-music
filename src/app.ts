import { play, playSequence, setSoundEnabled, unlockAudio } from './audio/pluck';
import { pressChordAccidental, pressRoot, pressSuffix } from './input/chordKeyboard';
import { createInput, pressAccidental, pressBackspace, pressLetter, selectField, type NoteInput } from './input/noteKeyboard';
import { Session } from './learn/session';
import { Store, type ModuleSettings } from './learn/store';
import { heatmapData, weakest } from './learn/stats';
import { findModule, MODULES } from './modules/catalog';
import { dailyModule, dailyQuestions, dueCount } from './modules/daily';
import { defaultSettings, type ChordAnswer, type ModuleDef, type NotesAnswer, type ShapeAnswer, type TapAnswer } from './modules/types';
import { shapeMidi } from './music/chords';
import { fretMidi, type StringNo } from './music/guitar';
import { renderHome } from './screens/home';
import { renderQuiz } from './screens/quiz';
import { dueKeys, renderSetup, toggleSetting } from './screens/setup';
import { renderSettings, type DataUi } from './screens/settings';
import { renderStats } from './screens/stats';
import { CHANGES_MS, formatClock, pairKey, renderChanges, type ChangesState } from './screens/changes';
import { renderHeatmap } from './render/heatmap';
import { esc } from './util/html';
import { renderSummary, summarize, type SummaryData } from './screens/summary';

/** umgesetzte Module in Lernweg-Reihenfolge */
const DEFS: ModuleDef[] = MODULES.flatMap((m) => (m.def ? [m.def] : []));

export interface AppOptions {
  root: HTMLElement;
  store: Store;
  baseUrl: string;
  showInstallHint: boolean;
}

/** Test-Schnittstelle für E2E: Lösung der aktuellen Frage. */
export interface QuizProbe {
  kind: 'notes' | 'choice' | 'tap' | 'chord' | 'shape';
  /** chord: Grundton und Zusatz; shape: Standardgriff */
  root?: { letter: number; acc: number };
  suffix?: string;
  shape?: (number | null)[];
  phase: string;
  /** Element-Schlüssel der Frage */
  items: string[];
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
  private changes: ChangesState | null = null;
  private changesTimer: number | undefined;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private dataUi: DataUi = { exportText: '', importText: '', confirmImport: false, confirmReset: false, message: null };

  constructor(private o: AppOptions) {
    setSoundEnabled(o.store.settings.sound);
    o.root.addEventListener('click', (e) => this.onClick(e));
    // iOS startet Audio nur aus einer Nutzeraktion heraus
    o.root.addEventListener('pointerdown', () => unlockAudio(), { passive: true });
    window.addEventListener('hashchange', () => {
      // Trainer verlassen: laufende Runde beenden, ohne zu speichern
      if (this.changes?.phase === 'running' && this.route().name !== 'changes') this.finishChanges(false);
      // Meldungen und Rückfragen der Einstellungen gelten nur, solange man dort ist
      this.dataUi = { ...this.dataUi, confirmImport: false, confirmReset: false, message: null };
      this.render();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth || this.route().name !== 'quiz') return;
      lastWidth = window.innerWidth;
      this.render();
    });
  }

  /** Telefon quer: breiter als hoch und niedrig (Desktop-Fenster zählen nicht). */
  private isPhoneLandscape(): boolean {
    return window.innerWidth > window.innerHeight && window.innerHeight <= 520;
  }

  /** Telefon hoch: schmal und höher als breit. */
  private isPhonePortrait(): boolean {
    return window.innerWidth < 600 && window.innerHeight > window.innerWidth;
  }

  /** Breite für Grafiken: Inhaltsbreite ohne Seitenränder und Rahmen der Grafik. */
  private figureWidth(): number {
    // Inhaltsbreite der aktuellen Seite messen (berücksichtigt Safe Areas); sonst schätzen
    const app = this.o.root.querySelector<HTMLElement>('.app');
    const landscape = this.isPhoneLandscape();
    if (app && app.closest('.quiz')?.classList.contains('is-landscape') === landscape) {
      const cs = getComputedStyle(app);
      return app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2 * 6 - 2;
    }
    const vw = document.documentElement.clientWidth || window.innerWidth;
    return (landscape ? Math.min(vw, 1000) : Math.min(vw, 640)) - 2 * 16 - 2 * 6 - 2;
  }

  get store(): Store {
    return this.o.store;
  }

  private route(): { name: string; id?: string } {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, id] = h.split('/');
    if (name === 'm' && id) return { name: 'setup', id };
    if (['quiz', 'summary', 'settings', 'stats', 'changes'].includes(name ?? '')) return { name: name! };
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
        landscape: this.isPhoneLandscape(),
        boardHeight: window.innerHeight - 168,
        portraitPhone: this.isPhonePortrait(),
      });
    } else if (r.name === 'summary') {
      if (!this.session || !this.summary) return this.go('#/');
      root.innerHTML = renderSummary(this.summary, this.store.streak(), this.summaryExtra(this.session.module));
    } else if (r.name === 'settings') {
      this.dataUi.exportText = this.store.exportJson();
      root.innerHTML = renderSettings(this.store.settings, this.dataUi);
    } else if (r.name === 'changes') {
      const st = this.changesState();
      root.innerHTML = renderChanges(st, this.store.data.best[pairKey(st.a, st.b)] ?? 0, this.store.now(), lang);
    } else if (r.name === 'stats') {
      root.innerHTML = renderStats(this.store, DEFS);
    } else {
      root.innerHTML = renderHome({
        showInstallHint: this.o.showInstallHint,
        baseUrl: this.o.baseUrl,
        store: this.store,
        due: dueCount(this.store, DEFS),
      });
    }
    document.documentElement.lang = 'de';
  }

  /** Modulspezifische Auswertung: Heatmap (M4), schwächste Noten (M2/M3). */
  private summaryExtra(mod: ModuleDef): string {
    const lang = this.store.settings.lang;
    if (mod.id === 'fret') {
      return `<h2 class="section-title">Griffbrett-Heatmap</h2><div class="card">${renderHeatmap(heatmapData(this.store.data.items), lang, this.store.settings.fretView)}</div>`;
    }
    if (mod.id === 'staff' || mod.id === 'read') {
      const weak = weakest(this.store.data.items, mod.prefixes, 5);
      if (!weak.length) return '';
      return `<h2 class="section-title">Schwächste Noten</h2>
        <ol class="card weak-list" data-testid="weakest">${weak
          .map((w) => `<li><span class="weak-label">${esc(mod.label(w.key, lang))}</span><span class="weak-num">${w.n - w.c}/${w.n} falsch</span></li>`)
          .join('')}</ol>`;
    }
    return '';
  }

  /** Zustand des Akkordwechsel-Trainers; die Auswahl wird gemerkt. */
  private changesState(): ChangesState {
    if (!this.changes) {
      const saved = this.store.data.modules.changes ?? {};
      this.changes = { a: (saved.a as string) ?? 'A', b: (saved.b as string) ?? 'D', phase: 'setup', endsAt: 0, count: 0, previousBest: 0 };
    }
    return this.changes;
  }

  private startChanges(): void {
    const st = this.changesState();
    st.phase = 'running';
    st.count = 0;
    st.previousBest = this.store.data.best[pairKey(st.a, st.b)] ?? 0;
    st.endsAt = this.store.now() + CHANGES_MS;
    // Bildschirm wach halten; Fehler (z. B. nicht unterstützt) still ignorieren
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (this.wakeLock = l), () => {});
    window.clearInterval(this.changesTimer);
    this.changesTimer = window.setInterval(() => this.tickChanges(), 200);
    this.render();
  }

  private tickChanges(): void {
    const st = this.changes;
    if (!st || st.phase !== 'running') return window.clearInterval(this.changesTimer);
    const left = st.endsAt - this.store.now();
    if (left <= 0) return this.finishChanges();
    const el = this.o.root.querySelector('[data-testid=changes-time]');
    if (el) el.textContent = formatClock(left);
  }

  private finishChanges(save = true): void {
    const st = this.changes!;
    window.clearInterval(this.changesTimer);
    this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
    if (!save) {
      st.phase = 'setup';
      return this.render();
    }
    st.phase = 'done';
    const key = pairKey(st.a, st.b);
    if (st.count > (this.store.data.best[key] ?? 0)) {
      this.store.data.best[key] = st.count;
      this.store.save();
    }
    this.render();
  }

  private startDaily(): void {
    const forced = dailyQuestions(this.store, DEFS);
    if (!forced.length) return this.go('#/');
    this.start(dailyModule(this.store, DEFS), forced);
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
      case 'chord-root':
      case 'chord-acc':
      case 'chord-suffix': {
        if (!c || c.question.kind !== 'chord' || c.phase !== 'answering') return;
        const cur = (c.answer as ChordAnswer) ?? { root: null, suffix: null };
        c.answer =
          a === 'chord-root'
            ? pressRoot(cur, Number(el.dataset.letter))
            : a === 'chord-acc'
              ? pressChordAccidental(cur, Number(el.dataset.acc) as 1 | -1)
              : pressSuffix(cur, el.dataset.suffix ?? '');
        return this.render();
      }
      case 'cd-open':
      case 'cd-cell': {
        if (!c || c.question.kind !== 'shape' || c.phase !== 'answering') return;
        const shape = [...((c.answer as ShapeAnswer) ?? [0, 0, 0, 0, 0, 0])];
        const i = Number(el.dataset.index);
        if (a === 'cd-open') shape[i] = shape[i] === null ? 0 : null;
        else {
          const f = Number(el.dataset.fret);
          shape[i] = shape[i] === f ? 0 : f;
        }
        c.answer = shape;
        if (this.store.settings.sound && shape[i] !== null) {
          const m = shapeMidi(shape.map((x, j) => (j === i ? x : null)));
          play(m);
        }
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
        return this.go(id && id !== 'daily' ? `#/m/${id}` : '#/');
      }
      case 'restart':
        if (this.lastModule?.id === 'daily') return this.startDaily();
        if (this.lastModule) this.start(this.lastModule);
        return;
      case 'changes-pick': {
        const st = this.changesState();
        if (el.dataset.slot === 'a') st.a = el.dataset.id!;
        else st.b = el.dataset.id!;
        this.store.data.modules.changes = { a: st.a, b: st.b };
        this.store.save();
        return this.render();
      }
      case 'changes-start':
        return this.startChanges();
      case 'changes-tap': {
        const st = this.changes;
        if (!st || st.phase !== 'running') return;
        if (st.endsAt - this.store.now() <= 0) return this.finishChanges();
        st.count++;
        const el2 = this.o.root.querySelector('[data-testid=changes-count]');
        if (el2) el2.textContent = String(st.count);
        return;
      }
      case 'changes-stop':
        return this.finishChanges(false);
      case 'changes-setup':
        this.changesState().phase = 'setup';
        return this.render();
      case 'start-daily':
        return this.startDaily();
      case 'export-copy': {
        const text = this.store.exportJson();
        const done = (ok: boolean) => {
          this.dataUi.message = ok
            ? { ok: true, text: 'Lernstand in die Zwischenablage kopiert.' }
            : { ok: false, text: 'Kopieren nicht möglich – unter „Lernstand anzeigen“ markieren und kopieren.' };
          this.render();
        };
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
        else done(false);
        return;
      }
      case 'export-file': {
        const blob = new Blob([this.store.exportJson()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `saitenlesen-${new Date(this.store.now()).toISOString().slice(0, 10)}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.dataUi.message = { ok: true, text: 'Datei gespeichert.' };
        return this.render();
      }
      case 'import': {
        const text = this.o.root.querySelector<HTMLTextAreaElement>('[data-testid=import-text]')?.value ?? '';
        this.dataUi.importText = text;
        this.dataUi.confirmReset = false;
        if (!text.trim()) this.dataUi.message = { ok: false, text: 'Bitte zuerst einen gesicherten Lernstand einfügen.' };
        else this.dataUi.confirmImport = true;
        return this.render();
      }
      case 'import-cancel':
        this.dataUi.confirmImport = false;
        return this.render();
      case 'import-confirm': {
        const ok = this.store.importJson(this.dataUi.importText);
        this.dataUi.confirmImport = false;
        this.dataUi.message = ok
          ? { ok: true, text: 'Lernstand wiederhergestellt.' }
          : { ok: false, text: 'Das ist kein gültiger Saitenlesen-Lernstand. Nichts wurde geändert.' };
        if (ok) {
          this.dataUi.importText = '';
          setSoundEnabled(this.store.settings.sound);
        }
        return this.render();
      }
      case 'reset':
        this.dataUi.confirmReset = true;
        this.dataUi.confirmImport = false;
        return this.render();
      case 'reset-cancel':
        this.dataUi.confirmReset = false;
        return this.render();
      case 'reset-confirm':
        this.store.reset();
        this.dataUi = { exportText: '', importText: '', confirmImport: false, confirmReset: false, message: { ok: true, text: 'Lernstand gelöscht.' } };
        setSoundEnabled(this.store.settings.sound);
        return this.render();
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
    if (q.kind === 'choice') return { kind: 'choice', phase: c.phase, items: [...q.items], correct: q.correct, options: q.options.length };
    if (q.kind === 'tap') return { kind: 'tap', phase: c.phase, items: [...q.items], targets: q.targets.map((t) => ({ ...t })), multi: q.multi };
    if (q.kind === 'chord') return { kind: 'chord', phase: c.phase, items: [...q.items], root: { ...q.answer.root }, suffix: q.answer.suffix };
    if (q.kind === 'shape') return { kind: 'shape', phase: c.phase, items: [...q.items], shape: [...q.solutionShape] };
    return { kind: 'notes', phase: c.phase, items: [...q.items], fields: q.fields.map((f) => ({ letter: f.answer.letter, acc: f.answer.acc })) };
  }
}
