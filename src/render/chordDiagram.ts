import { STRINGS, type StringNo } from '../music/guitar';
import { esc } from '../util/html';

export interface ChordDiagramOptions {
  highlight?: StringNo;
  label: string;
  frets?: number;
}

/** Leeres Akkorddiagramm, senkrecht, tiefe E-Saite links. */
export function renderChordDiagram({ highlight, label, frets = 5 }: ChordDiagramOptions): string {
  const gap = 28;
  const fretH = 34;
  const left = 22;
  const top = 26;
  const width = left * 2 + gap * 5;
  const height = top + fretH * frets + 14;
  const p: string[] = [];
  p.push(`<rect class="cd-nut" x="${left - 1}" y="${top - 5}" width="${gap * 5 + 2}" height="6" rx="1"/>`);
  for (let f = 1; f <= frets; f++) {
    p.push(`<line class="cd-fret" x1="${left}" x2="${left + gap * 5}" y1="${top + f * fretH}" y2="${top + f * fretH}"/>`);
  }
  STRINGS.forEach((s, i) => {
    const x = left + i * gap;
    const hl = highlight === s;
    p.push(`<line class="cd-string${hl ? ' cd-hl' : ''}" x1="${x}" x2="${x}" y1="${top}" y2="${top + frets * fretH}" stroke-width="${hl ? 4 : 1.5}"/>`);
    if (hl) p.push(`<path class="cd-arrow" d="M${x - 7} ${top - 20}L${x + 7} ${top - 20}L${x} ${top - 9}Z"/>`);
  });
  return `<svg class="chord-diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${p.join('')}</svg>`;
}
