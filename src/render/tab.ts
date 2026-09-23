import { STRINGS, stringLetter, type StringNo } from '../music/guitar';
import type { Lang } from '../music/names';
import { esc } from '../util/html';

export interface TabOptions {
  highlight?: StringNo;
  /** Saitennamen statt „TAB“ */
  names?: boolean;
  lang: Lang;
  label: string;
  width?: number;
}

/** Tab-System: 6 Linien, oben die hohe e-Saite. */
export function renderTab({ highlight, names = false, lang, label, width = 300 }: TabOptions): string {
  const lineGap = 14;
  const top = 12;
  const left = 30;
  const height = top * 2 + lineGap * 5;
  const p: string[] = [];
  // STRINGS ist tief → hoch; im Tab steht die 1. Saite oben
  [...STRINGS].reverse().forEach((s, i) => {
    const y = top + i * lineGap;
    const hl = highlight === s;
    p.push(`<line class="tab-line${hl ? ' tab-hl' : ''}" x1="${left}" x2="${width - 4}" y1="${y}" y2="${y}"/>`);
    if (names) p.push(`<text class="tab-name" x="${left - 8}" y="${y + 4}" text-anchor="end">${esc(stringLetter(s, lang))}</text>`);
  });
  if (!names) {
    ['T', 'A', 'B'].forEach((ch, i) => {
      p.push(`<text class="tab-clef" x="${left - 14}" y="${top + 20 + i * 18}" text-anchor="middle">${ch}</text>`);
    });
  }
  p.push(`<line class="tab-bar" x1="${left}" x2="${left}" y1="${top}" y2="${top + 5 * lineGap}"/>`);
  p.push(`<line class="tab-bar" x1="${width - 4}" x2="${width - 4}" y1="${top}" y2="${top + 5 * lineGap}"/>`);
  return `<svg class="tab" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${p.join('')}</svg>`;
}
