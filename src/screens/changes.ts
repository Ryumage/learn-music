import { CHORDS, parseChord, parseShape } from '../music/chords';
import type { Lang } from '../music/names';
import { chordTitle } from '../modules/chords';
import { renderChordShape } from '../render/chordDiagram';
import { ICONS } from '../render/icons';
import { esc } from '../util/html';

/** Wählbare Akkorde: Grundakkorde, F, Fmaj7, Septakkorde (PLAN W). */
export const CHANGE_CHORDS = CHORDS.filter((c) => c.set === 'basic' || c.id === 'Fs' || c.id === 'Fmaj7' || c.set === 'seven');

/** Dauer einer Runde in ms */
export const CHANGES_MS = 60_000;
/** Richtwert: 30 Wechsel pro Minute (JustinGuitar Grade 1) */
export const CHANGES_TARGET = 30;

/** Bestwert-Schlüssel unabhängig von der Reihenfolge: „A|D“ = „D|A“. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export interface ChangesState {
  a: string;
  b: string;
  phase: 'setup' | 'running' | 'done';
  endsAt: number;
  count: number;
  /** Bestwert vor dieser Runde */
  previousBest: number;
}

function chips(slot: 'a' | 'b', selected: string, other: string, lang: Lang): string {
  return CHANGE_CHORDS.map((c) => {
    const on = c.id === selected;
    const disabled = c.id === other;
    const title = lang === 'de' ? chordTitle(parseChord(c.symbol), c.label, 'de') : c.label;
    return `<button type="button" class="chip${on ? ' is-on' : ''}" data-action="changes-pick" data-slot="${slot}" data-id="${esc(c.id)}" aria-pressed="${on}" aria-label="${esc(title)}"${disabled ? ' disabled' : ''}>${esc(c.label)}</button>`;
  }).join('');
}

function diagrams(s: ChangesState): string {
  return `<div class="changes-diagrams">${[s.a, s.b]
    .map((id) => {
      const c = CHORDS.find((x) => x.id === id)!;
      return `<figure class="card changes-diagram"><figcaption>${esc(c.label)}</figcaption>${renderChordShape({ shape: parseShape(c.shape), fingers: c.fingers, label: `Akkorddiagramm ${c.label}` })}</figure>`;
    })
    .join('')}</div>`;
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function renderChanges(s: ChangesState, best: number, now: number, lang: Lang): string {
  const head = `<header class="topbar">
      <a class="icon-btn" href="#/" aria-label="Zur Übersicht">${ICONS.back}</a>
      <h1 class="title-sm">Akkordwechsel</h1>
    </header>`;
  if (s.phase === 'running') {
    return `<main class="app changes-page">
        ${head}
        ${diagrams(s)}
        <button type="button" class="changes-tap" data-action="changes-tap" data-testid="changes-tap">
          <span class="changes-count" data-testid="changes-count">${s.count}</span>
          <span class="changes-label">Wechsel – hier tippen</span>
          <span class="changes-time" data-testid="changes-time">${formatClock(s.endsAt - now)}</span>
        </button>
        <button type="button" class="btn" data-action="changes-stop">Abbrechen</button>
      </main>`;
  }
  if (s.phase === 'done') {
    const record = s.count > s.previousBest;
    return `<main class="app changes-page">
        ${head}
        <section class="card summary-hero" data-testid="changes-result">
          <p class="changes-count">${s.count}</p>
          <p class="summary-main"><strong>Wechsel in einer Minute</strong></p>
          <p class="${record ? 'record' : 'muted'}">${record ? (s.previousBest > 0 ? `Neuer Bestwert! Vorher: ${s.previousBest}` : 'Erster Bestwert!') : `Bestwert: ${best}`}</p>
          <p class="muted small">Richtwert: ${CHANGES_TARGET} Wechsel pro Minute.</p>
        </section>
        <div class="actions">
          <button type="button" class="btn btn-primary" data-action="changes-start">Nochmal</button>
          <button type="button" class="btn" data-action="changes-setup">Andere Akkorde</button>
        </div>
      </main>`;
  }
  return `<main class="app changes-page">
      ${head}
      <p class="lead">Eine Minute lang zwischen zwei Akkorden wechseln. Jeder Wechsel ein Tipp – so wächst die Sicherheit beim Umgreifen.</p>
      <section class="card settings-card">
        <div class="setting"><h3 class="setting-label">Akkord 1</h3><div class="chips" role="group" aria-label="Akkord 1">${chips('a', s.a, s.b, lang)}</div></div>
        <div class="setting"><h3 class="setting-label">Akkord 2</h3><div class="chips" role="group" aria-label="Akkord 2">${chips('b', s.b, s.a, lang)}</div></div>
      </section>
      ${diagrams(s)}
      <p class="muted" data-testid="changes-best">Bestwert für dieses Paar: ${best || '–'} · Richtwert: ${CHANGES_TARGET} pro Minute</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-action="changes-start" data-testid="changes-start">Start · 1 Minute</button>
      </div>
    </main>`;
}
