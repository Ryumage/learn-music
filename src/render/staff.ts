import { type Note } from '../music/notes';
import { staffStep } from '../music/staff';
import { esc } from '../util/html';

export type MarkState = 'ok' | 'bad' | 'active' | 'solution' | null;

export interface StaffOptions {
  /** Spalten mit gleichzeitig klingenden Noten */
  columns: Note[][];
  /** Zustand je Spalte (Farbe) */
  states?: MarkState[];
  /** Linienabstand in SVG-Einheiten */
  sp?: number;
  /** Breite einer Notenspalte in sp */
  colWidth?: number;
  /** Anzahl Spaltenplätze (Breite des Systems), falls größer als columns.length */
  slots?: number;
  /** Zustand je Note (Spalte → Note in der gegebenen Reihenfolge) */
  noteStates?: MarkState[][];
  /** Antwortfeld je Note; macht die Note antippbar */
  noteFields?: number[][];
  /** Platz über der obersten und unter der untersten Linie in sp */
  above?: number;
  below?: number;
  label: string;
}

/** Geometrie für Layouts, die Felder unter die Spalten setzen. */
export const CLEF_SP = 4;
export const END_SP = 1;

const ACC_GLYPH: Record<number, string> = { [-2]: '♭♭', [-1]: '♭', 1: '♯', 2: '♯♯' };

/** Ganze Note: Ellipse mit schräg gestelltem Loch (fill-rule evenodd). */
function wholeNote(cx: number, cy: number, sp: number): string {
  const rx = sp * 0.78;
  const ry = sp * 0.52;
  const a = sp * 0.42; // Loch, große Halbachse
  const b = sp * 0.27;
  const th = (-35 * Math.PI) / 180;
  const x1 = cx + a * Math.cos(th);
  const y1 = cy + a * Math.sin(th);
  const x2 = cx - a * Math.cos(th);
  const y2 = cy - a * Math.sin(th);
  const f = (n: number) => n.toFixed(2);
  return (
    `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z` +
    `M${f(x1)} ${f(y1)}A${f(a)} ${f(b)} -35 1 0 ${f(x2)} ${f(y2)}A${f(a)} ${f(b)} -35 1 0 ${f(x1)} ${f(y1)}Z`
  );
}

/** Notensystem mit Violinschlüssel (oktaviert) und ganzen Noten. */
export function renderStaff({
  columns,
  states = [],
  sp = 10,
  colWidth = 4,
  slots,
  noteStates,
  noteFields,
  above,
  below,
  label,
}: StaffOptions): string {
  // Platz über/unter dem System nach den extremsten Noten (Hilfslinien, Schlüssel mit 8)
  const allSteps = columns.flat().map(staffStep);
  if (above === undefined) above = Math.max(2.4, (Math.max(...allSteps, 8) - 8) / 2 + 1.4);
  if (below === undefined) below = Math.max(3.4, -Math.min(...allSteps, 0) / 2 + 1.2);
  const clefW = CLEF_SP * sp;
  const top = above * sp;
  const bottom = top + 4 * sp;
  const height = bottom + below * sp;
  const width = clefW + Math.max(slots ?? 0, columns.length) * colWidth * sp + END_SP * sp;
  const y = (d: number) => bottom - (d * sp) / 2;
  const parts: string[] = [];

  for (let i = 0; i < 5; i++) {
    parts.push(`<line class="st-line" x1="0" x2="${width}" y1="${top + i * sp}" y2="${top + i * sp}"/>`);
  }
  // Violinschlüssel mit 8 darunter; Grundlinie der Glyphe auf der untersten Linie
  parts.push(
    `<text class="st-clef" x="${0.3 * sp}" y="${bottom}" font-size="${4 * sp}" aria-hidden="true">\u{1D120}</text>`,
  );

  columns.forEach((notes, ci) => {
    const cx = clefW + (ci + 0.55) * colWidth * sp;
    const state = states[ci] ?? null;
    const cls = state ? ` st-${state}` : '';
    const steps = notes.map(staffStep);
    const lo = Math.min(...steps);
    const hi = Math.max(...steps);
    const ledger: string[] = [];
    for (let d = -2; d >= lo; d -= 2) ledger.push(`<line class="st-ledger" x1="${cx - 1.25 * sp}" x2="${cx + 1.25 * sp}" y1="${y(d)}" y2="${y(d)}"/>`);
    for (let d = 10; d <= hi; d += 2) ledger.push(`<line class="st-ledger" x1="${cx - 1.25 * sp}" x2="${cx + 1.25 * sp}" y1="${y(d)}" y2="${y(d)}"/>`);
    const heads: string[] = [];
    let lastAccStep: number | null = null;
    let accShift = 0;
    [...notes]
      .map((n, i) => ({ n, d: steps[i]!, i }))
      .sort((a, b) => b.d - a.d)
      .forEach(({ n, d, i }) => {
        const ns = noteStates?.[ci]?.[i];
        const field = noteFields?.[ci]?.[i];
        const nCls = ns ? ` st-${ns}` : '';
        const tap =
          field !== undefined
            ? ` data-action="field" data-field="${field}"`
            : '';
        heads.push(`<g class="st-note${nCls}"${tap}>`);
        if (field !== undefined) {
          heads.push(`<rect class="st-hit" x="${cx - 1.4 * sp}" y="${y(d) - 0.5 * sp}" width="${2.8 * sp}" height="${sp}"/>`);
        }
        heads.push(`<path class="st-head" fill-rule="evenodd" d="${wholeNote(cx, y(d), sp)}"/>`);
        if (n.acc !== 0) {
          // weniger als eine Sexte Abstand zum vorherigen Vorzeichen: eine Spalte weiter links
          accShift = lastAccStep !== null && lastAccStep - d < 5 ? accShift + 1 : 0;
          lastAccStep = d;
          const ax = cx - 1.35 * sp - accShift * 1.1 * sp;
          heads.push(
            `<text class="st-acc" x="${ax}" y="${y(d) + 0.35 * sp}" font-size="${2.2 * sp}" text-anchor="end">${ACC_GLYPH[n.acc]}</text>`,
          );
        }
        heads.push('</g>');
      });
    parts.push(`<g class="st-col${cls}" data-col="${ci}">${ledger.join('')}${heads.join('')}</g>`);
  });

  return `<svg class="staff" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}" style="--sp:${sp}">${parts.join('')}</svg>`;
}
