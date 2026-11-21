import { play, setSoundEnabled } from './audio/pluck';
import type { Store } from './learn/store';
import { patternPositions, playOrder, positionMidi } from './music/pentatonic';
import { currentPattern, newPentaToolState, PENTA_TEMPOS, renderPentaTool, type PentaToolState } from './screens/penta';
import { PATTERN_COUNT } from './music/pentatonic';

/**
 * Werkzeug „Pentatonik-Patterns“ (Issue #14): Tonart und Pattern wählen, blättern,
 * abspielen; der gerade gespielte Bund wird hervorgehoben.
 */
export class PentaTool {
  state: PentaToolState;
  private timer: number | undefined;
  private step = 0;

  constructor(
    private store: Store,
    private root: HTMLElement,
    private rerender: () => void,
  ) {
    this.state = newPentaToolState(store.data.modules.pentaTool ?? {});
  }

  html(): string {
    return renderPentaTool(this.state, this.store.settings.lang, this.store.settings.fretView);
  }

  private save(): void {
    const s = this.state;
    this.store.data.modules.pentaTool = { type: s.type, root: String(s.root), pattern: String(s.pattern), labels: s.labels, tempo: String(s.tempo) };
    this.store.save();
  }

  /** Auswahl ändern: Wiedergabe stoppt, Seite neu zeichnen. */
  set(action: string, value: string): void {
    this.stop(false);
    const s = this.state;
    if (action === 'penta-type') s.type = value === 'major' ? 'major' : 'minor';
    if (action === 'penta-root') s.root = Number(value);
    if (action === 'penta-pattern') {
      s.pattern = Number(value);
      s.page = s.pattern || s.page;
    }
    if (action === 'penta-page') s.page = Math.min(PATTERN_COUNT, Math.max(1, s.page + Number(value)));
    if (action === 'penta-labels') s.labels = value === 'note' ? 'note' : 'degree';
    if (action === 'penta-tempo' && (PENTA_TEMPOS as readonly number[]).includes(Number(value))) s.tempo = Number(value);
    this.save();
    this.rerender();
  }

  toggle(): void {
    if (this.state.playing) return this.stop();
    this.state.playing = true;
    this.step = 0;
    this.rerender();
    const order = playOrder(patternPositions(this.state.type, this.state.root, currentPattern(this.state)));
    const tick = () => {
      const p = order[this.step];
      if (!p) return this.stop();
      this.highlight(`${p.string}:${p.fret}`);
      // Wiedergabe auf Wunsch auch bei ausgeschaltetem Ton
      setSoundEnabled(true);
      play([positionMidi(p)]);
      setSoundEnabled(this.store.settings.sound);
      this.step++;
    };
    tick();
    this.timer = window.setInterval(tick, 60_000 / this.state.tempo);
  }

  private highlight(id: string | null): void {
    this.root.querySelectorAll('.penta-board .fb-marker.is-playing').forEach((el) => el.classList.remove('is-playing'));
    if (id) this.root.querySelector(`.penta-board [data-marker="${id}"]`)?.classList.add('is-playing');
  }

  /** Wiedergabe beenden (beim Verlassen der Seite ohne Neuzeichnen). */
  stop(redraw = true): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
    if (!this.state.playing) return;
    this.state.playing = false;
    this.highlight(null);
    if (redraw) this.rerender();
  }
}
