import { renderPattern, rootLabel } from '../modules/pentatonic';
import type { Lang } from '../music/names';
import { DEGREE_LABELS, PATTERN_COUNT, patternPositions, patternSpan, pentaName, PENTA_STEPS, scaleNoteName, type PentaType } from '../music/pentatonic';
import { ICONS } from '../render/icons';
import { esc } from '../util/html';

export interface PentaToolState {
  type: PentaType;
  root: number;
  /** 0 = alle Patterns (blättern), sonst ein bestimmtes */
  pattern: number;
  /** angezeigtes Pattern beim Blättern */
  page: number;
  labels: 'degree' | 'note';
  /** Töne pro Minute */
  tempo: number;
  playing: boolean;
}

export const PENTA_TEMPOS = [60, 90, 120] as const;

export function newPentaToolState(saved: Record<string, unknown>): PentaToolState {
  const root = Number(saved.root ?? 9);
  const pattern = Number(saved.pattern ?? 0);
  const tempo = Number(saved.tempo ?? 90);
  return {
    type: saved.type === 'major' ? 'major' : 'minor',
    root: Number.isInteger(root) && root >= 0 && root < 12 ? root : 9,
    pattern: Number.isInteger(pattern) && pattern >= 0 && pattern <= PATTERN_COUNT ? pattern : 0,
    page: 1,
    labels: saved.labels === 'note' ? 'note' : 'degree',
    tempo: (PENTA_TEMPOS as readonly number[]).includes(tempo) ? tempo : 90,
    playing: false,
  };
}

/** angezeigtes Pattern */
export function currentPattern(s: PentaToolState): number {
  return s.pattern || s.page;
}

function chip(action: string, value: string | number, label: string, on: boolean, extra = ''): string {
  return `<button type="button" class="chip${on ? ' is-on' : ''}" data-action="${action}" data-value="${esc(String(value))}" aria-pressed="${on}"${extra}>${esc(label)}</button>`;
}

export function renderPentaTool(s: PentaToolState, lang: Lang, view: 'low-bottom' | 'low-top'): string {
  const n = currentPattern(s);
  const name = pentaName(s.type, s.root, lang);
  const ps = patternPositions(s.type, s.root, n);
  const [lo, hi] = patternSpan(ps);
  const tones = PENTA_STEPS[s.type].map((st) => scaleNoteName(s.type, s.root, (s.root + st) % 12, lang));
  const degrees = DEGREE_LABELS[s.type];

  const pager = s.pattern === 0
    ? `<div class="penta-pager">
        <button type="button" class="btn btn-small" data-action="penta-page" data-value="-1" aria-label="Vorheriges Pattern"${n <= 1 ? ' disabled' : ''}>‹</button>
        <span data-testid="penta-page">Pattern ${n} von ${PATTERN_COUNT}</span>
        <button type="button" class="btn btn-small" data-action="penta-page" data-value="1" aria-label="Nächstes Pattern"${n >= PATTERN_COUNT ? ' disabled' : ''}>›</button>
      </div>`
    : `<p class="penta-pager" data-testid="penta-page">Pattern ${n}</p>`;

  const overview = Array.from({ length: PATTERN_COUNT }, (_, i) => {
    const k = i + 1;
    const [a, b] = patternSpan(patternPositions(s.type, s.root, k));
    return `<button type="button" class="penta-thumb${k === n ? ' is-on' : ''}" data-action="penta-pattern" data-value="${k}" aria-pressed="${k === n}" aria-label="Pattern ${k}, Bund ${a} bis ${b}">
        <span class="penta-thumb-title">Pattern ${k} <span class="muted small">Bund ${a}–${b}</span></span>
        ${renderPattern({ type: s.type, root: s.root, n: k, lang, view, labels: 'none', label: `Pattern ${k}` })}
      </button>`;
  }).join('');

  return `<main class="app penta-page">
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Zur Übersicht">${ICONS.back}</a>
        <h1 class="title-sm">Pentatonik-Patterns</h1>
      </header>
      <p class="lead">Fünf Töne, fünf Patterns über den ganzen Hals. Wähle Tonart und Pattern, hör es dir an und spiel mit – der gespielte Bund leuchtet auf.</p>
      <section class="card settings-card">
        <div class="setting"><h3 class="setting-label">Tonleiter</h3><div class="chips" role="group" aria-label="Tonleiter">${chip('penta-type', 'minor', 'Moll-Pentatonik', s.type === 'minor')}${chip('penta-type', 'major', 'Dur-Pentatonik', s.type === 'major')}</div></div>
        <div class="setting"><h3 class="setting-label">Grundton</h3><div class="chips" role="group" aria-label="Grundton">${Array.from({ length: 12 }, (_, pc) => chip('penta-root', pc, rootLabel(pc, lang), pc === s.root)).join('')}</div></div>
        <div class="setting"><h3 class="setting-label">Pattern</h3><div class="chips" role="group" aria-label="Pattern">${chip('penta-pattern', 0, 'Alle', s.pattern === 0)}${Array.from({ length: PATTERN_COUNT }, (_, i) => chip('penta-pattern', i + 1, String(i + 1), s.pattern === i + 1)).join('')}</div></div>
      </section>

      <section class="card penta-main" aria-labelledby="penta-title">
        <h2 id="penta-title" class="lib-title" data-testid="penta-title">${esc(name)}</h2>
        <p class="muted small">Töne: <b>${esc(tones.join(' '))}</b> · Stufen: ${esc(degrees.join(' '))}${s.type === 'major' ? ` · gleiche Patterns wie ${esc(pentaName('minor', (s.root + 9) % 12, lang))}` : ''}</p>
        ${pager}
        <div class="figure figure-board penta-board" data-testid="penta-board">${renderPattern({ type: s.type, root: s.root, n, lang, view, labels: s.labels, label: `${name}, Pattern ${n}, Bund ${lo} bis ${hi}` })}</div>
        <p class="muted small penta-legend">Bund ${lo}–${hi} · Grundton hervorgehoben · 12 Töne, zwei pro Saite</p>
        <div class="setting"><h3 class="setting-label">Beschriftung</h3><div class="chips" role="group" aria-label="Beschriftung">${chip('penta-labels', 'degree', 'Stufen', s.labels === 'degree')}${chip('penta-labels', 'note', 'Töne', s.labels === 'note')}</div></div>
        <div class="setting"><h3 class="setting-label">Tempo</h3><div class="chips" role="group" aria-label="Tempo">${PENTA_TEMPOS.map((t) => chip('penta-tempo', t, `${t} ♩`, s.tempo === t)).join('')}</div></div>
        <div class="actions penta-actions">
          <button type="button" class="btn btn-primary" data-action="penta-play" data-testid="penta-play">${s.playing ? '■ Stopp' : '▶ Abspielen (auf und ab)'}</button>
          <button type="button" class="btn" data-action="penta-practice" data-testid="penta-practice">Pattern ${n} üben</button>
        </div>
      </section>

      <h2 class="section-title">Alle Patterns</h2>
      <div class="penta-thumbs">${overview}</div>
    </main>`;
}
