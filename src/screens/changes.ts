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
/** Einzählen vor dem Start in ms */
export const COUNT_IN_MS = 5_000;
/** Richtwert: 30 Wechsel pro Minute (JustinGuitar Grade 1) */
export const CHANGES_TARGET = 30;
/** höchstens dreistellige Eingabe */
const MAX_DIGITS = 3;

/** Selbst zählen (Zahl am Ende eintippen) oder per Mikrofon (Beta). */
export type CountMode = 'self' | 'mic';

/** Bestwert-Schlüssel unabhängig von der Reihenfolge: „A|D“ = „D|A“. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export interface ChangesState {
  a: string;
  b: string;
  mode: CountMode;
  phase: 'setup' | 'starting' | 'countin' | 'running' | 'enter' | 'done';
  /** Ende des Einzählens = Start der Minute */
  startsAt: number;
  endsAt: number;
  /** Ergebnis der Runde */
  count: number;
  /** Eingabe auf dem Ziffernblock */
  entry: string;
  /** erste Taste ersetzt die vorbelegte Zahl */
  entryFresh: boolean;
  /** vom Mikrofon erkannt (nur im Mikrofon-Modus) */
  detected: { changes: number; strums: number } | null;
  /** Mikrofon läuft in dieser Runde */
  micActive: boolean;
  /** Hinweis, z. B. wenn das Mikrofon nicht startet */
  notice: string | null;
  /** Bestwert vor dieser Runde */
  previousBest: number;
}

export function newChangesState(saved: Record<string, unknown>): ChangesState {
  return {
    a: (saved.a as string) ?? 'A',
    b: (saved.b as string) ?? 'D',
    mode: saved.mode === 'mic' ? 'mic' : 'self',
    phase: 'setup',
    startsAt: 0,
    endsAt: 0,
    count: 0,
    entry: '',
    entryFresh: false,
    detected: null,
    micActive: false,
    notice: null,
    previousBest: 0,
  };
}

/** Ziffernblock: Ziffer anhängen oder löschen; die erste Taste ersetzt einen vorbelegten Wert. */
export function pressKey(entry: string, fresh: boolean, key: string): string {
  if (key === 'del') return fresh ? '' : entry.slice(0, -1);
  if (!/^\d$/.test(key)) return entry;
  const base = fresh || entry === '0' ? '' : entry;
  return base.length >= MAX_DIGITS ? base : base + key;
}

function chips(slot: 'a' | 'b', selected: string, other: string, lang: Lang): string {
  return CHANGE_CHORDS.map((c) => {
    const on = c.id === selected;
    const disabled = c.id === other;
    const title = lang === 'de' ? chordTitle(parseChord(c.symbol), c.label, 'de') : c.label;
    return `<button type="button" class="chip${on ? ' is-on' : ''}" data-action="changes-pick" data-slot="${slot}" data-id="${esc(c.id)}" aria-pressed="${on}" aria-label="${esc(title)}"${disabled ? ' disabled' : ''}>${esc(c.label)}</button>`;
  }).join('');
}

const labelOf = (id: string) => CHORDS.find((x) => x.id === id)!.label;

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

/** Sekunden bis zum Start (5 … 1) */
export function countInSeconds(startsAt: number, now: number): number {
  return Math.max(1, Math.ceil((startsAt - now) / 1000));
}

function modeChips(mode: CountMode): string {
  const opts: [CountMode, string][] = [
    ['self', 'Selbst zählen'],
    ['mic', 'Mikrofon (Beta)'],
  ];
  return `<div class="chips" role="group" aria-label="Zählen">${opts
    .map(([v, l]) => `<button type="button" class="chip${v === mode ? ' is-on' : ''}" aria-pressed="${v === mode}" data-action="changes-mode" data-value="${v}">${l}</button>`)
    .join('')}</div>`;
}

function keypad(): string {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0'];
  return `<div class="numpad" role="group" aria-label="Ziffernblock">${keys
    .map((k) =>
      k === 'del'
        ? `<button type="button" class="key key-fn" data-action="changes-key" data-key="del" aria-label="Löschen">⌫</button>`
        : `<button type="button" class="key" data-action="changes-key" data-key="${k}">${k}</button>`,
    )
    .join('')}</div>`;
}

export interface ChangesView {
  best: number;
  now: number;
  lang: Lang;
  /** Ton an: Einzählen und Ende sind zu hören */
  sound: boolean;
}

export function renderChanges(s: ChangesState, v: ChangesView): string {
  const head = `<header class="topbar">
      <a class="icon-btn" href="#/" aria-label="Zur Übersicht">${ICONS.back}</a>
      <h1 class="title-sm">Akkordwechsel</h1>
    </header>`;
  const abort = '<button type="button" class="btn" data-action="changes-stop">Abbrechen</button>';
  const page = (body: string) => `<main class="app changes-page">${head}${body}</main>`;

  if (s.phase === 'starting') {
    return page(`${diagrams(s)}<section class="card changes-stage" role="status"><p class="changes-big-label">Mikrofon wird gestartet …</p></section>${abort}`);
  }

  if (s.phase === 'countin') {
    const secs = countInSeconds(s.startsAt, v.now);
    return page(`${diagrams(s)}
      <section class="card changes-stage" aria-live="polite">
        <p class="changes-big" data-testid="changes-countin">${secs}</p>
        <p class="changes-big-label">Gleich geht’s los – beginne mit <b>${esc(labelOf(s.a))}</b>.</p>
      </section>
      ${s.notice ? `<p class="card changes-notice" role="alert" data-testid="changes-notice">${esc(s.notice)}</p>` : ''}
      ${abort}`);
  }

  if (s.phase === 'running') {
    const counting = s.micActive
      ? `<p class="changes-live" data-testid="changes-detected" aria-live="off"><b>${s.detected?.changes ?? 0}</b> Wechsel erkannt · ${s.detected?.strums ?? 0} Anschläge</p>`
      : '<p class="changes-big-label">Zähl im Kopf mit – am Ende tippst du die Zahl ein.</p>';
    return page(`${diagrams(s)}
      <section class="card changes-stage">
        <p class="changes-big changes-clock" data-testid="changes-time">${formatClock(s.endsAt - v.now)}</p>
        ${counting}
      </section>
      ${abort}`);
  }

  if (s.phase === 'enter') {
    const intro = s.detected
      ? `<p>Das Mikrofon hat <b>${s.detected.changes}</b> Wechsel erkannt (${s.detected.strums} Anschläge). Stimmt das? Sonst einfach korrigieren.</p>`
      : '<p>Wie viele Wechsel hast du geschafft?</p>';
    return page(`
      <section class="card changes-enter">
        <h2 class="changes-enter-title">Zeit!</h2>
        ${intro}
        <p class="changes-entry" data-testid="changes-entry" aria-live="polite" aria-label="Anzahl Wechsel">${esc(s.entry) || '<span class="muted">0</span>'}</p>
        ${keypad()}
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-action="changes-save" data-testid="changes-save"${s.entry ? '' : ' disabled'}>Speichern</button>
        <button type="button" class="btn" data-action="changes-setup">Verwerfen</button>
      </div>`);
  }

  if (s.phase === 'done') {
    const record = s.count > s.previousBest;
    return page(`
      <section class="card summary-hero" data-testid="changes-result">
        <p class="changes-count">${s.count}</p>
        <p class="summary-main"><strong>Wechsel in einer Minute</strong></p>
        <p class="${record ? 'record' : 'muted'}">${record ? (s.previousBest > 0 ? `Neuer Bestwert! Vorher: ${s.previousBest}` : 'Erster Bestwert!') : `Bestwert: ${v.best}`}</p>
        <p class="muted small">Richtwert: ${CHANGES_TARGET} Wechsel pro Minute.</p>
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-action="changes-start">Nochmal</button>
        <button type="button" class="btn" data-action="changes-setup">Andere Akkorde</button>
      </div>`);
  }

  const modeText =
    s.mode === 'mic'
      ? 'Das Mikrofon hört mit: Schlag nach jedem Wechsel einmal an. Gezählt wird, wenn der Klang zum anderen Akkord springt. Am besten in ruhiger Umgebung, iPhone nah an der Gitarre. Die Aufnahme bleibt auf dem Gerät. Am Ende kannst du die Zahl korrigieren.'
      : 'Zähl während der Minute im Kopf mit (z. B. bei jedem Anschlag) und tipp die Zahl am Ende ein.';
  return page(`
      <p class="lead">Eine Minute lang zwischen zwei Akkorden wechseln. Nach jedem Wechsel einmal anschlagen – so wächst die Sicherheit beim Umgreifen.</p>
      <section class="card settings-card">
        <div class="setting"><h3 class="setting-label">Akkord 1</h3><div class="chips" role="group" aria-label="Akkord 1">${chips('a', s.a, s.b, v.lang)}</div></div>
        <div class="setting"><h3 class="setting-label">Akkord 2</h3><div class="chips" role="group" aria-label="Akkord 2">${chips('b', s.b, s.a, v.lang)}</div></div>
        <div class="setting"><h3 class="setting-label">Zählen</h3>${modeChips(s.mode)}<p class="muted small" data-testid="changes-mode-text">${esc(modeText)}</p></div>
      </section>
      ${s.notice ? `<p class="card changes-notice" role="alert" data-testid="changes-notice">${esc(s.notice)}</p>` : ''}
      ${diagrams(s)}
      <p class="muted" data-testid="changes-best">Bestwert für dieses Paar: ${v.best || '–'} · Richtwert: ${CHANGES_TARGET} pro Minute</p>
      ${v.sound ? '' : '<p class="muted small">Der Ton ist aus: Einzählen und Ende siehst du nur auf dem Bildschirm.</p>'}
      <div class="actions">
        <button type="button" class="btn btn-primary" data-action="changes-start" data-testid="changes-start">Start · 5 s einzählen, 1 Minute</button>
      </div>`);
}
