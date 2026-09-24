import { STRINGS, stringLetter, type Position, type StringNo } from '../music/guitar';
import type { Lang } from '../music/names';
import { esc } from '../util/html';
import type { MarkState } from './staff';

export type FretView = 'low-bottom' | 'low-top';

export interface FretMarker {
  string: StringNo;
  fret: number;
  text?: string;
  state?: MarkState;
}

export interface FretboardOptions {
  from: number;
  to: number;
  /** „Tiefe E-Saite unten“ (Standard View, Sattel links) oder „oben“ (Student View, Sattel rechts) */
  view?: FretView;
  /** Beschriftung neben den Saiten: Nummern, Namen oder nichts */
  labels?: 'numbers' | 'names' | 'none';
  highlight?: StringNo;
  markers?: FretMarker[];
  /** Saiten, deren Zellen antippbar sind */
  tappable?: readonly StringNo[];
  /** Saiten der Aufgabe; alle anderen werden abgedunkelt */
  active?: readonly StringNo[];
  lang: Lang;
  label: string;
  /** Zellgröße in SVG-Einheiten überschreiben (Querformat: an den Bildschirm angepasst) */
  cellW?: number;
  rowH?: number;
}

/** Geometrie in SVG-Einheiten; bei 375 px Breite ergibt das ≈ 37 × 31 px pro Zelle (8 Bünde). */
export const DEFAULT_CELL_W = 40;
export const DEFAULT_ROW_H = 34;
const LABEL_W = 24;
const OPEN_W = 30;
const TOP_PAD = 22;
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

/** Fenster mit höchstens 8 Bünden (ohne Leersaiten-Spalte) um eine Stelle, innerhalb des Bereichs. */
export function fretWindow(range: readonly [number, number], around: number, rng: () => number = Math.random): [number, number] {
  const [lo, hi] = range;
  const span = 8;
  // mit Leersaiten-Spalte passen Bund 0–7, sonst 8 Bünde
  if (lo === 0 && hi <= 7) return [0, hi];
  if (hi - lo + 1 <= span) return [lo, hi];
  const minStart = Math.max(lo, around - span + 1);
  const maxStart = Math.min(hi - span + 1, around);
  const start = minStart + Math.floor(rng() * (maxStart - minStart + 1));
  // Start bei 0: Leersaiten-Spalte plus Bund 1–7
  return start === 0 ? [0, 7] : [start, start + span - 1];
}

/** Griffbrett als SVG mit Tippflächen je Zelle. */
export function renderFretboard(o: FretboardOptions): string {
  const CELL_W = o.cellW ?? DEFAULT_CELL_W;
  const ROW_H = o.rowH ?? DEFAULT_ROW_H;
  const view = o.view ?? 'low-bottom';
  const labels = o.labels ?? 'none';
  const hasOpen = o.from === 0;
  const firstFret = hasOpen ? 1 : o.from;
  const frets = o.to - firstFret + 1;
  const labelW = labels === 'none' ? 4 : LABEL_W;
  // Leersaiten-Spalte wächst mit der Zellbreite (Querformat)
  const openW = hasOpen ? (OPEN_W * CELL_W) / DEFAULT_CELL_W : 0;
  const boardW = frets * CELL_W;
  const width = labelW + openW + boardW + 6;
  const height = TOP_PAD + ROW_H * 6 + 4;
  const mirror = view === 'low-top';
  const X = (x: number) => (mirror ? width - x : x);
  const boardX0 = labelW + openW;
  const rowOf = (s: StringNo) => (view === 'low-bottom' ? s - 1 : 6 - s);
  const yOf = (s: StringNo) => TOP_PAD + ROW_H * (rowOf(s) + 0.5);
  const cellCenter = (fret: number) => (fret === 0 ? labelW + openW / 2 : boardX0 + (fret - firstFret + 0.5) * CELL_W);
  const tappable = new Set(o.tappable ?? []);
  const active = o.active ? new Set(o.active) : null;
  const dimmedString = (s: StringNo) => active !== null && !active.has(s);

  const p: string[] = [];
  const bx = Math.min(X(boardX0), X(boardX0 + boardW));
  p.push(`<rect class="fb-wood" x="${bx}" y="${TOP_PAD}" width="${boardW}" height="${ROW_H * 6}" rx="3"/>`);

  for (let f = firstFret; f <= o.to; f++) {
    const cx = X(cellCenter(f));
    const cy = TOP_PAD + ROW_H * 3;
    if (f === 12 || f === 24) {
      p.push(`<circle class="fb-inlay" cx="${cx}" cy="${cy - ROW_H * 1.5}" r="5"/><circle class="fb-inlay" cx="${cx}" cy="${cy + ROW_H * 1.5}" r="5"/>`);
    } else if (INLAYS.includes(f)) {
      p.push(`<circle class="fb-inlay" cx="${cx}" cy="${cy}" r="5"/>`);
    }
  }

  for (let i = 0; i <= frets; i++) {
    const x = X(boardX0 + i * CELL_W);
    p.push(
      hasOpen && i === 0
        ? `<rect class="fb-nut" x="${x - 4}" y="${TOP_PAD - 2}" width="8" height="${ROW_H * 6 + 4}" rx="2"/>`
        : `<line class="fb-fret" x1="${x}" x2="${x}" y1="${TOP_PAD}" y2="${TOP_PAD + ROW_H * 6}"/>`,
    );
  }

  for (let f = firstFret; f <= o.to; f++) {
    p.push(`<text class="fb-num" x="${X(cellCenter(f))}" y="${TOP_PAD - 7}" text-anchor="middle">${f}</text>`);
  }

  for (const s of STRINGS) {
    const y = yOf(s);
    const hl = o.highlight === s;
    const dimmed = dimmedString(s);
    const w = 1 + (s - 1) * 0.45;
    const cls = ['fb-string', s >= 4 ? 'fb-wound' : '', hl ? 'fb-hl' : '', dimmed ? 'fb-dim' : ''].filter(Boolean).join(' ');
    p.push(
      `<line class="${cls}" x1="${X(labelW + (hasOpen ? 4 : 0))}" x2="${X(boardX0 + boardW)}" y1="${y}" y2="${y}" stroke-width="${hl ? w + 2.5 : w}"/>`,
    );
    if (labels !== 'none') {
      const text = labels === 'numbers' ? String(s) : stringLetter(s, o.lang);
      p.push(
        `<g class="fb-label${hl ? ' fb-hl' : ''}${dimmed ? ' fb-dim' : ''}"><circle cx="${X(labelW / 2)}" cy="${y}" r="10"/><text x="${X(labelW / 2)}" y="${y + 4.5}" text-anchor="middle">${esc(text)}</text></g>`,
      );
    }
  }

  // Abgedunkelte Saiten: Schleier über der Zeile
  if (active) {
    for (const s of STRINGS) {
      if (!dimmedString(s)) continue;
      const y = TOP_PAD + ROW_H * rowOf(s);
      const x0 = Math.min(X(labelW), X(boardX0 + boardW));
      p.push(`<rect class="fb-veil" x="${x0}" y="${y}" width="${openW + boardW}" height="${ROW_H}"/>`);
    }
  }

  for (const m of o.markers ?? []) {
    const cx = X(cellCenter(m.fret));
    const cy = yOf(m.string);
    const cls = m.state ? ` fb-${m.state}` : '';
    p.push(
      `<g class="fb-marker${cls}" data-marker="${m.string}:${m.fret}"><circle cx="${cx}" cy="${cy}" r="12"/>${m.text ? `<text x="${cx}" y="${cy + 4.5}" text-anchor="middle">${esc(m.text)}</text>` : ''}</g>`,
    );
  }

  // Tippflächen zuletzt, damit sie über allem liegen
  if (tappable.size) {
    for (const s of STRINGS) {
      if (!tappable.has(s)) continue;
      for (let f = o.from; f <= o.to; f++) {
        const w = f === 0 ? openW : CELL_W;
        const left = f === 0 ? labelW : boardX0 + (f - firstFret) * CELL_W;
        const x = mirror ? width - left - w : left;
        p.push(
          `<rect class="fb-cell" x="${x}" y="${TOP_PAD + ROW_H * rowOf(s)}" width="${w}" height="${ROW_H}" data-action="tap" data-string="${s}" data-fret="${f}" role="button" aria-label="${esc(`${s}. Saite, ${f === 0 ? 'leer' : `${f}. Bund`}`)}"/>`,
        );
      }
    }
  }

  return `<svg class="fretboard" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(o.label)}">${p.join('')}</svg>`;
}

/**
 * Zellgröße fürs Querformat: das Griffbrett füllt die Breite, die Zeilenhöhe passt in die Höhe.
 * Maße in px; das SVG wird ohne Skalierung (1 Einheit = 1 px) dargestellt.
 */
export function landscapeGeometry(from: number, to: number, width: number, height: number): { cellW: number; rowH: number } {
  const frets = to - (from === 0 ? 1 : from) + 1;
  const cells = frets + (from === 0 ? OPEN_W / DEFAULT_CELL_W : 0);
  const cellW = Math.max(DEFAULT_CELL_W, (width - LABEL_W - 6) / cells);
  const rowH = Math.max(28, Math.min(cellW * 0.8, (height - TOP_PAD - 4) / 6));
  return { cellW, rowH };
}

export function samePosition(a: Position, b: Position): boolean {
  return a.string === b.string && a.fret === b.fret;
}
