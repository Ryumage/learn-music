import { ChangeDetector, chordTemplate } from './audio/changeDetector';
import { listen, micErrorText, type MicListener } from './audio/mic';
import { beep } from './audio/pluck';
import type { Store } from './learn/store';
import { gripById } from './music/chordLibrary';
import { parseShape, shapeMidi } from './music/chords';
import {
  CHANGES_MS,
  COUNT_IN_MS,
  countInSeconds,
  formatClock,
  newChangesState,
  pairKey,
  pressKey,
  renderChanges,
  type ChangesState,
  type CountMode,
} from './screens/changes';

type WakeLock = { release: () => Promise<void> };

const midisOf = (id: string) => shapeMidi(parseShape(gripById(id)!.shape));

/**
 * Akkordwechsel-Trainer: 5 s einzählen, 1 Minute wechseln, dann die Zahl eintippen
 * (oder vom Mikrofon vorbelegen lassen). Der Bestwert wird pro Paar gespeichert.
 */
export class ChangesTrainer {
  state: ChangesState;
  private timer: number | undefined;
  private wakeLock: WakeLock | null = null;
  private mic: MicListener | null = null;
  private detector: ChangeDetector | null = null;
  private lastCountIn = 0;
  /** Zähler, damit ein abgebrochener Start nicht nachträglich weiterläuft */
  private run = 0;

  constructor(
    private store: Store,
    private root: HTMLElement,
    private rerender: () => void,
  ) {
    this.state = newChangesState(store.data.modules.changes ?? {});
  }

  /** Runde läuft oder startet gerade */
  get active(): boolean {
    return ['starting', 'countin', 'running'].includes(this.state.phase);
  }

  html(): string {
    const st = this.state;
    return renderChanges(st, {
      best: this.store.data.best[pairKey(st.a, st.b)] ?? 0,
      now: this.store.now(),
      lang: this.store.settings.lang,
      sound: this.store.settings.sound,
    });
  }

  private saveChoice(): void {
    const st = this.state;
    this.store.data.modules.changes = { a: st.a, b: st.b, mode: st.mode };
    this.store.save();
  }

  pick(slot: string, id: string): void {
    if (slot === 'a') this.state.a = id;
    else this.state.b = id;
    this.saveChoice();
    this.rerender();
  }

  setMode(mode: CountMode): void {
    this.state.mode = mode;
    this.state.notice = null;
    this.saveChoice();
    this.rerender();
  }

  async start(): Promise<void> {
    const st = this.state;
    const run = ++this.run;
    st.previousBest = this.store.data.best[pairKey(st.a, st.b)] ?? 0;
    st.detected = null;
    st.notice = null;
    st.micActive = false;
    // Bildschirm wach halten; Fehler (z. B. nicht unterstützt) still ignorieren
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
    nav.wakeLock?.request('screen').then(
      (l) => (this.wakeLock = l),
      () => {},
    );

    if (st.mode === 'mic') {
      st.phase = 'starting';
      this.rerender();
      const templates: [number[], number[]] = [chordTemplate(midisOf(st.a)), chordTemplate(midisOf(st.b))];
      try {
        const mic = await listen((block) => this.detector?.feed(block));
        if (run !== this.run) return mic.stop();
        this.mic = mic;
        this.detector = new ChangeDetector(mic.sampleRate, templates);
        st.micActive = true;
      } catch (err) {
        if (run !== this.run) return;
        st.notice = `${micErrorText(err)} Diesmal zählst du selbst.`;
      }
    }

    st.phase = 'countin';
    st.startsAt = this.store.now() + COUNT_IN_MS;
    st.endsAt = st.startsAt + CHANGES_MS;
    this.lastCountIn = 0;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 100);
    this.tick();
    this.rerender();
  }

  private tick(): void {
    const st = this.state;
    const now = this.store.now();
    if (st.phase === 'countin') {
      if (now >= st.startsAt) {
        st.phase = 'running';
        beep(1320, 0.15);
        // den Startton selbst nicht als Anschlag zählen
        this.detector?.arm(0.25);
        return this.rerender();
      }
      const secs = countInSeconds(st.startsAt, now);
      if (secs !== this.lastCountIn) {
        this.lastCountIn = secs;
        beep(880, 0.09);
        const el = this.root.querySelector('[data-testid=changes-countin]');
        if (el) el.textContent = String(secs);
      }
      return;
    }
    if (st.phase !== 'running') return window.clearInterval(this.timer);
    if (now >= st.endsAt) return this.finishRun();
    const el = this.root.querySelector('[data-testid=changes-time]');
    if (el) el.textContent = formatClock(st.endsAt - now);
    if (this.detector) {
      st.detected = { changes: this.detector.changes, strums: this.detector.strums };
      const live = this.root.querySelector('[data-testid=changes-detected]');
      if (live) live.innerHTML = `<b>${st.detected.changes}</b> Wechsel erkannt · ${st.detected.strums} Anschläge`;
    }
  }

  private release(): void {
    window.clearInterval(this.timer);
    this.mic?.stop();
    this.mic = null;
    this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  private finishRun(): void {
    const st = this.state;
    if (this.detector) st.detected = { changes: this.detector.changes, strums: this.detector.strums };
    this.detector = null;
    this.release();
    beep(1320, 0.15);
    beep(1320, 0.3, 0.2);
    st.phase = 'enter';
    st.entry = st.detected ? String(st.detected.changes) : '';
    st.entryFresh = st.detected !== null;
    this.rerender();
  }

  /** Abbrechen: nichts speichern, zurück zur Auswahl. */
  abort(): void {
    this.run++;
    this.detector = null;
    this.release();
    this.state.phase = 'setup';
    this.rerender();
  }

  key(k: string): void {
    const st = this.state;
    if (st.phase !== 'enter') return;
    st.entry = pressKey(st.entry, st.entryFresh, k);
    st.entryFresh = false;
    this.rerender();
  }

  save(): void {
    const st = this.state;
    if (st.phase !== 'enter' || !st.entry) return;
    st.count = Number(st.entry);
    const key = pairKey(st.a, st.b);
    if (st.count > (this.store.data.best[key] ?? 0)) {
      this.store.data.best[key] = st.count;
      this.store.save();
    }
    st.phase = 'done';
    this.rerender();
  }

  toSetup(): void {
    this.state.phase = 'setup';
    this.rerender();
  }
}
