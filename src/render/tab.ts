import { STRINGS, stringLetter, type StringNo } from '../music/guitar';
import type { Lang } from '../music/names';
import { BEATS, beamGroups, type NoteValue } from '../music/rhythm';
import { esc } from '../util/html';

export interface TabNote {
  string: StringNo;
  /** Bundzahl oder Zeichen („x“, „?“, „<12>“) */
  text: string;
  /** hervorgehoben (Frage) */
  mark?: boolean;
}

export interface TabColumn {
  notes: TabNote[];
  /** Notenwert unter dem Tab */
  rhythm?: NoteValue;
  /** Notenwert zählt für die Balken, wird aber nicht gezeichnet (gesuchter Wert „?“) */
  hideRhythm?: boolean;
}

export interface TabArc {
  string: StringNo;
  from: number;
  to: number;
  /** „H“ oder „P“ über dem Bogen */
  label?: string;
}

export interface TabOptions {
  columns?: TabColumn[];
  /** Taktstrich nach diesen Spalten (Index); Anfang und Ende haben immer einen */
  bars?: number[];
  arcs?: TabArc[];
  /** Text über dem Tab, z. B. „PM“ mit Linie über Spalte from–to */
  above?: { from: number; to: number; text: string; line?: boolean }[];
  highlight?: StringNo;
  /** Saitennamen statt „TAB“ */
  names?: boolean;
  lang: Lang;
  label: string;
  /** Breite ohne Spalten (leeres System) */
  width?: number;
}

const LINE_GAP = 18;
const LEFT = 30;
const COL_W = 34;
const COL_PAD = 14;

/** Zeile im Tab: oben die 1. Saite (hohe e). */
const rowOf = (s: StringNo) => s - 1;

/** Tab-System mit Zahlen, Bögen und Rhythmus darunter (UG-/Guitar-Pro-Stil). */
export function renderTab(o: TabOptions): string {
  const cols = o.columns ?? [];
  const hasRhythm = cols.some((c) => c.rhythm);
  const top = o.above?.length ? 34 : o.arcs?.length ? 28 : 12;
  const tabBottom = top + LINE_GAP * 5;
  const width = cols.length ? LEFT + COL_PAD * 2 + cols.length * COL_W : (o.width ?? 300);
  const height = tabBottom + (hasRhythm ? 44 : 12);
  const right = width - 4;
  const xOf = (i: number) => LEFT + COL_PAD + (i + 0.5) * COL_W;
  const yOf = (s: StringNo) => top + rowOf(s) * LINE_GAP;
  const p: string[] = [];

  for (const s of [...STRINGS].reverse()) {
    const y = yOf(s);
    const hl = o.highlight === s;
    p.push(`<line class="tab-line${hl ? ' tab-hl' : ''}" x1="${LEFT}" x2="${right}" y1="${y}" y2="${y}"/>`);
    if (o.names) p.push(`<text class="tab-name" x="${LEFT - 8}" y="${y + 4}" text-anchor="end">${esc(stringLetter(s, o.lang))}</text>`);
  }
  if (!o.names) {
    ['T', 'A', 'B'].forEach((ch, i) => {
      p.push(`<text class="tab-clef" x="${LEFT - 14}" y="${top + 2.5 * LINE_GAP + (i - 1) * 24 + 6}" text-anchor="middle">${ch}</text>`);
    });
  }
  const bar = (x: number) => p.push(`<line class="tab-bar" x1="${x}" x2="${x}" y1="${top}" y2="${tabBottom}"/>`);
  bar(LEFT);
  bar(right);
  for (const b of o.bars ?? []) if (b < cols.length - 1) bar(LEFT + COL_PAD + (b + 1) * COL_W);

  // Text über dem Tab (PM----, let ring)
  for (const a of o.above ?? []) {
    const x1 = xOf(a.from) - 10;
    const x2 = xOf(a.to) + 10;
    p.push(`<text class="tab-above" x="${x1}" y="${top - 16}">${esc(a.text)}</text>`);
    if (a.line) {
      const tx = x1 + a.text.length * 9 + 4;
      p.push(`<line class="tab-above-line" x1="${tx}" x2="${x2}" y1="${top - 20}" y2="${top - 20}"/><line class="tab-above-line" x1="${x2}" x2="${x2}" y1="${top - 24}" y2="${top - 16}"/>`);
    }
  }

  // Bögen über den Zahlen
  for (const a of o.arcs ?? []) {
    const x1 = xOf(a.from) + 2;
    const x2 = xOf(a.to) - 2;
    const y = yOf(a.string) - 9;
    const mid = (x1 + x2) / 2;
    p.push(`<path class="tab-arc" d="M${x1} ${y} Q${mid} ${y - 14} ${x2} ${y}"/>`);
    if (a.label) p.push(`<text class="tab-arc-label" x="${mid}" y="${y - 10}" text-anchor="middle">${esc(a.label)}</text>`);
  }

  // Zahlen mit Aussparung
  cols.forEach((c, i) => {
    const x = xOf(i);
    const circled = !c.hideRhythm && (c.rhythm === 'whole' || c.rhythm === 'dhalf' || c.rhythm === 'half');
    for (const n of c.notes) {
      const y = yOf(n.string);
      const w = Math.max(12, n.text.length * 9 + 4);
      p.push(`<rect class="tab-knock" x="${x - w / 2}" y="${y - 7}" width="${w}" height="14"/>`);
      if (circled) p.push(`<circle class="tab-circle${n.mark ? ' is-mark' : ''}" cx="${x}" cy="${y}" r="10"/>`);
      else if (n.mark) p.push(`<rect class="tab-mark" x="${x - w / 2 - 3}" y="${y - 10}" width="${w + 6}" height="20" rx="5"/>`);
      p.push(`<text class="tab-num${n.mark ? ' is-mark' : ''}" x="${x}" y="${y + 5}" text-anchor="middle">${esc(n.text)}</text>`);
    }
  });

  if (hasRhythm) p.push(rhythmMarks(cols, xOf, tabBottom));

  // kurze Tabs nicht aufblasen: höchstens 1,3-fach
  return `<svg class="tab" viewBox="0 0 ${width} ${height}" style="max-width:${Math.round(width * 1.3)}px" role="img" aria-label="${esc(o.label)}">${p.join('')}</svg>`;
}

/** Hälse nach unten, Balken unten (PLAN M7). */
function rhythmMarks(cols: TabColumn[], xOf: (i: number) => number, tabBottom: number): string {
  const p: string[] = [];
  const y0 = tabBottom + 6;
  const longEnd = tabBottom + 34;
  const shortEnd = tabBottom + 16;
  const values = cols.map((c) => (c.hideRhythm ? null : (c.rhythm ?? null)));
  // Balkengruppen nach dem echten Takt; verborgene Spalten trennen eine Gruppe
  const groups: number[][] = [];
  for (const g of beamGroups(cols.map((c) => c.rhythm ?? 'quarter'))) {
    let cur: number[] = [];
    for (const i of g) {
      if (values[i]) cur.push(i);
      else {
        if (cur.length > 1) groups.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) groups.push(cur);
  }
  const beamed = new Set(groups.flat());

  values.forEach((v, i) => {
    if (!v || v === 'whole') return;
    const x = xOf(i);
    const short = v === 'half' || v === 'dhalf';
    const end = short ? shortEnd : longEnd;
    p.push(`<line class="tab-stem" x1="${x}" x2="${x}" y1="${y0}" y2="${end}"/>`);
    if (v === 'dhalf' || v === 'dquarter') p.push(`<circle class="tab-dot" cx="${x + 6}" cy="${end - 2}" r="2.2"/>`);
    if (!beamed.has(i) && BEATS[v] < 1) {
      // Fähnchen
      const flags = v === 'sixteenth' ? 2 : 1;
      for (let f = 0; f < flags; f++) {
        const fy = end - f * 6;
        p.push(`<path class="tab-flag" d="M${x} ${fy} q6 -3 9 -11"/>`);
      }
    }
  });

  for (const g of groups) {
    const x1 = xOf(g[0]!);
    const x2 = xOf(g[g.length - 1]!);
    p.push(`<rect class="tab-beam" x="${x1}" y="${longEnd - 3}" width="${x2 - x1}" height="3.5"/>`);
    // zweiter Balken für Sechzehntel
    let k = 0;
    while (k < g.length) {
      if (values[g[k]!] !== 'sixteenth') {
        k++;
        continue;
      }
      let e = k;
      while (e + 1 < g.length && values[g[e + 1]!] === 'sixteenth') e++;
      const a = xOf(g[k]!);
      const b = xOf(g[e]!);
      if (e > k) p.push(`<rect class="tab-beam" x="${a}" y="${longEnd - 9}" width="${b - a}" height="3.5"/>`);
      else {
        // einzelne Sechzehntel in der Gruppe: kurzer Stummel zur Nachbarnote
        const dir = k === g.length - 1 ? -1 : 1;
        const sx = dir > 0 ? a : a - 9;
        p.push(`<rect class="tab-beam" x="${sx}" y="${longEnd - 9}" width="9" height="3.5"/>`);
      }
      k = e + 1;
    }
  }
  return p.join('');
}

/** Text-Tab im Monospace-Stil von Ultimate Guitar, z. B. „e|---5h7---|“. */
export function renderTextTab(lines: string[], label: string): string {
  return `<pre class="tab-text" role="img" aria-label="${esc(label)}">${lines.map((l) => esc(l)).join('\n')}</pre>`;
}
