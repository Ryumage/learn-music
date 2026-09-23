import { STRINGS, stringLetter, type StringNo } from '../music/guitar';
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
  /** „Tiefe E-Saite unten“ (Standard View) oder „oben“ (Student View, Sattel rechts) */
  view?: FretView;
  /** Beschriftung links bzw. rechts: Saitennummern, -namen oder nichts */
  labels?: 'numbers' | 'names' | 'none';
  highlight?: StringNo;
  markers?: FretMarker[];
  lang: Lang;
  label: string;
}

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

/** Griffbrett als SVG. Zellen sind breit genug für Tippflächen (höchstens 8 Bünde). */
export function renderFretboard(o: FretboardOptions): string {
  const view = o.view ?? 'low-bottom';
  const labels = o.labels ?? 'none';
  const frets = o.to - o.from + (o.from === 0 ? 0 : 1);
  const hasOpen = o.from === 0;
  const labelW = labels === 'none' ? 8 : 34;
  const openW = hasOpen ? 40 : 0;
  const cellW = 64;
  const rowH = 32;
  const topPad = 24;
  const boardW = frets * cellW;
  const width = labelW + openW + boardW + 8;
  const height = topPad + rowH * 6 + 6;
  const mirror = view === 'low-top';
  // x-Koordinate im Standard-Layout → gespiegelt für die Spieler-Sicht
  const X = (x: number) => (mirror ? width - x : x);
  const boardX0 = labelW + openW;
  const rowOf = (s: StringNo) => (view === 'low-bottom' ? s - 1 : 6 - s);
  const yOf = (s: StringNo) => topPad + rowH * (rowOf(s) + 0.5);
  const fretX = (i: number) => boardX0 + i * cellW; // i = Bundstab-Index ab Fensteranfang
  const firstFret = hasOpen ? 1 : o.from;
  const cellCenter = (fret: number) => (fret === 0 ? labelW + openW / 2 : boardX0 + (fret - firstFret + 0.5) * cellW);

  const p: string[] = [];
  const x0 = X(boardX0);
  const x1 = X(boardX0 + boardW);
  p.push(`<rect class="fb-wood" x="${Math.min(x0, x1)}" y="${topPad}" width="${boardW}" height="${rowH * 6}" rx="3"/>`);

  // Einlagen
  for (let f = firstFret; f <= o.to; f++) {
    const cx = X(cellCenter(f));
    const cy = topPad + rowH * 3;
    if (f === 12 || f === 24) {
      p.push(`<circle class="fb-inlay" cx="${cx}" cy="${cy - rowH * 1.5}" r="6"/><circle class="fb-inlay" cx="${cx}" cy="${cy + rowH * 1.5}" r="6"/>`);
    } else if (INLAYS.includes(f)) {
      p.push(`<circle class="fb-inlay" cx="${cx}" cy="${cy}" r="6"/>`);
    }
  }

  // Bundstäbe und Sattel
  for (let i = 0; i <= frets; i++) {
    const x = X(fretX(i));
    const nut = hasOpen && i === 0;
    p.push(
      nut
        ? `<rect class="fb-nut" x="${x - 4}" y="${topPad - 2}" width="8" height="${rowH * 6 + 4}" rx="2"/>`
        : `<line class="fb-fret" x1="${x}" x2="${x}" y1="${topPad}" y2="${topPad + rowH * 6}"/>`,
    );
  }

  // Bundnummern
  for (let f = firstFret; f <= o.to; f++) {
    p.push(`<text class="fb-num" x="${X(cellCenter(f))}" y="${topPad - 8}" text-anchor="middle">${f}</text>`);
  }

  // Saiten
  for (const s of STRINGS) {
    const y = yOf(s);
    const wound = s >= 4;
    const hl = o.highlight === s;
    const w = 1 + (s - 1) * 0.45;
    const xa = X(labelW + (hasOpen ? 6 : 0));
    const xb = X(boardX0 + boardW);
    p.push(
      `<line class="fb-string${wound ? ' fb-wound' : ''}${hl ? ' fb-hl' : ''}" x1="${xa}" x2="${xb}" y1="${y}" y2="${y}" stroke-width="${hl ? w + 2.5 : w}"/>`,
    );
    if (labels !== 'none') {
      const text = labels === 'numbers' ? String(s) : stringLetter(s, o.lang);
      p.push(
        `<g class="fb-label${hl ? ' fb-hl' : ''}"><circle cx="${X(labelW / 2)}" cy="${y}" r="12"/><text x="${X(labelW / 2)}" y="${y + 5}" text-anchor="middle">${esc(text)}</text></g>`,
      );
    }
  }

  // Markierungen
  for (const m of o.markers ?? []) {
    const cx = X(cellCenter(m.fret));
    const cy = yOf(m.string);
    const cls = m.state ? ` fb-${m.state}` : '';
    p.push(
      `<g class="fb-marker${cls}"><circle cx="${cx}" cy="${cy}" r="12"/>${m.text ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle">${esc(m.text)}</text>` : ''}</g>`,
    );
  }

  return `<svg class="fretboard" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(o.label)}">${p.join('')}</svg>`;
}
