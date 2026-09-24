import { renderField, type FieldOptions, type NoteInput } from '../input/noteKeyboard';
import type { Lang } from '../music/names';
import type { Note } from '../music/notes';
import { staffStep } from '../music/staff';
import { CLEF_SP, END_SP, renderStaff, type MarkState } from '../render/staff';

/** Spaltenbreite in Linienabständen; bei 375 px passen damit 8 Noten bei ≥ 9,5 px Linienabstand. */
export const COL_SP = 3.5;
export const MIN_SP_PX = 9.5;

/** Wie viele Spalten passen in ein System dieser Breite (px)? */
export function columnsPerSystem(widthPx: number): number {
  return Math.max(4, Math.floor((widthPx / MIN_SP_PX - CLEF_SP - END_SP) / COL_SP));
}

/** Teilt n Spalten gleichmäßig auf Systeme auf. */
export function splitSystems(n: number, perSystem: number): number[] {
  const systems = Math.ceil(n / perSystem);
  const per = Math.ceil(n / systems);
  const out: number[] = [];
  for (let i = 0; i < n; i += per) out.push(Math.min(per, n - i));
  return out;
}

export interface StaffRowView {
  columns: Note[][];
  fields: number[][];
  input: NoteInput;
  lang: Lang;
  /** verfügbare Breite in px */
  width: number;
  fieldOpts: FieldOptions;
  /** Zustand je Feld für die Farbe der Note */
  states: MarkState[];
}

/** Notenzeile mit Umbruch; unter jeder Spalte die Antwortfelder (von oben nach unten). */
export function renderStaffRow(v: StaffRowView): string {
  const per = columnsPerSystem(v.width);
  const sizes = splitSystems(v.columns.length, per);
  const slots = Math.max(...sizes);
  const steps = v.columns.flat().map(staffStep);
  const above = Math.max(2.4, (Math.max(...steps) - 8) / 2 + 1.4);
  const below = Math.max(3.4, -Math.min(...steps) / 2 + 1.2);
  const total = CLEF_SP + slots * COL_SP + END_SP;
  const pct = (sp: number) => `${((100 * sp) / total).toFixed(3)}%`;

  let start = 0;
  return sizes
    .map((size, si) => {
      const cols = v.columns.slice(start, start + size);
      const fields = v.fields.slice(start, start + size);
      start += size;
      const svg = renderStaff({
        columns: cols,
        slots,
        colWidth: COL_SP,
        above,
        below,
        noteFields: fields,
        noteStates: fields.map((fs) => fs.map((f) => (f === v.input.active && v.fieldOpts.interactive ? 'active' : v.states[f] ?? null))),
        label: `Notenzeile ${si + 1}`,
      });
      const cells = fields
        .map((fs) => `<div class="staff-cell">${fs.map((f) => renderField(v.input, f, v.lang, { ...v.fieldOpts, compact: true })).join('')}</div>`)
        .join('');
      return `<div class="staff-system">
          ${svg}
          <div class="staff-fields" style="grid-template-columns:${pct(CLEF_SP)} repeat(${slots}, ${pct(COL_SP)}) ${pct(END_SP)}">
            <span></span>${cells}
          </div>
        </div>`;
    })
    .join('');
}
