import { pickWeighted, shuffle } from '../learn/picker';
import type { ModuleSettings } from '../learn/store';
import { easiestPosition, playable, positionText } from '../music/guitar';
import { noteName, type Lang } from '../music/names';
import { diatonic, fromMidi, midi, noteKey, parseNote, soundingMidi, type Note } from '../music/notes';
import { staffPositionText } from '../music/staff';
import { COUNT_SETTING, type MakeContext, type ModuleDef, type NotesQuestion } from './types';

export interface Level {
  id: number;
  label: string;
  labelEn?: string;
  notes: Note[];
  maxFret: number;
  accidentals: boolean;
}

function naturals(from: string, to: string): Note[] {
  const lo = diatonic(parseNote(from));
  const hi = diatonic(parseNote(to));
  const out: Note[] = [];
  for (let d = lo; d <= hi; d++) out.push({ letter: d % 7, acc: 0, octave: Math.floor(d / 7) });
  return out;
}

/** Chromatisch; schwarze Tasten jeweils als ♯- und ♭-Variante. */
function chromatic(lo: number, hi: number): Note[] {
  const out: Note[] = [];
  for (let m = lo; m <= hi; m++) {
    const sharp = fromMidi(m, 'sharp');
    out.push(sharp);
    if (sharp.acc !== 0) out.push(fromMidi(m, 'flat'));
  }
  return out;
}

/** Stufen (PLAN M2), notierte Tonhöhe. */
export const LEVELS: readonly Level[] = [
  { id: 1, label: 'Leersaiten G, H, E', labelEn: 'Leersaiten G, B, E', notes: ['G4', 'B4', 'E5'].map(parseNote), maxFret: 4, accidentals: false },
  { id: 2, label: 'Saiten 1–2: E F G · H C D', labelEn: 'Saiten 1–2: E F G · B C D', notes: ['G4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'].map(parseNote), maxFret: 4, accidentals: false },
  { id: 3, label: '+ G-Saite: G A', notes: naturals('G4', 'G5'), maxFret: 4, accidentals: false },
  { id: 4, label: 'Alle Saiten, 1. Lage', notes: naturals('E3', 'G5'), maxFret: 4, accidentals: false },
  { id: 5, label: '1. Lage mit ♯ und ♭', notes: chromatic(52, 80), maxFret: 4, accidentals: true },
  { id: 6, label: 'Bis 12. Bund', notes: naturals('E3', 'E6'), maxFret: 12, accidentals: false },
  { id: 7, label: 'Bis 12. Bund mit ♯ und ♭', notes: chromatic(52, 88), maxFret: 12, accidentals: true },
];

export function level(settings: ModuleSettings): Level {
  return LEVELS[Math.min(Math.max(Number(settings.level ?? 1), 1), 7) - 1]!;
}

const key = (n: Note) => `staff:${noteKey(n)}`;
const noteOf = (k: string) => parseNote(k.slice('staff:'.length));

/** Wo auf der Gitarre: „A-Saite leer“, „hohe E-Saite, 5. Bund“. */
export function guitarPlace(n: Note, lang: Lang, maxFret: number): string {
  const pos = easiestPosition(soundingMidi(n), maxFret);
  return pos ? positionText(pos, lang) : '';
}

export function noteSolution(n: Note, lang: Lang, maxFret: number): string {
  return [noteName(n, lang), staffPositionText(n), guitarPlace(n, lang, maxFret)].filter(Boolean).join(' · ');
}

/**
 * Prüft einen Mehrklang: Abstand benachbarter Töne mindestens eine Terz und höchstens eine Dezime,
 * Vorzeichen mindestens eine Sexte auseinander, und auf der Gitarre greifbar.
 */
export function chordOk(notes: readonly Note[], maxFret: number): boolean {
  const sorted = [...notes].sort((a, b) => diatonic(a) - diatonic(b));
  for (let i = 1; i < sorted.length; i++) {
    const gap = diatonic(sorted[i]!) - diatonic(sorted[i - 1]!);
    if (gap < 2 || gap > 9) return false;
  }
  if (new Set(sorted.map(midi)).size !== sorted.length) return false;
  // Vorzeichen näher als eine Sexte müssten versetzt werden und stießen an die Nachbarspalte
  const accSteps = sorted.filter((n) => n.acc !== 0).map(diatonic);
  for (let i = 1; i < accSteps.length; i++) if (accSteps[i]! - accSteps[i - 1]! < 5) return false;
  return playable(sorted.map(soundingMidi), maxFret) !== null;
}

/** Ergänzt eine Note zu einem greifbaren Zwei- oder Dreiklang; null, wenn nichts passt. */
export function buildChord(base: Note, size: number, pool: readonly Note[], maxFret: number, rng: () => number): Note[] | null {
  let chord = [base];
  for (let tries = 0; tries < 40 && chord.length < size; tries++) {
    const cand = pool[Math.floor(rng() * pool.length)]!;
    const next = [...chord, cand];
    if (chordOk(next, maxFret)) chord = next;
  }
  return chord.length === size ? chord : null;
}

export interface RowOptions {
  level: Level;
  length: number;
  stacked: boolean;
  melody: boolean;
  /** Noten, die in der Zeile vorkommen müssen */
  forced: Note[];
  ctx: MakeContext;
}

/** Erzeugt eine Notenzeile: Spalten mit Tönen von oben nach unten. */
export function makeRow({ level: lv, length, stacked, melody, forced, ctx }: RowOptions): Note[][] {
  const { rng } = ctx;
  const pool = lv.notes;
  const keys = pool.map(key);
  const forcedAt = new Map<number, Note>();
  shuffle([...Array(length).keys()], rng)
    .slice(0, forced.length)
    .forEach((pos, i) => forcedAt.set(pos, forced[i]!));

  const recent = [...ctx.recent];
  const columns: Note[][] = [];
  let prev: Note | null = null;
  for (let c = 0; c < length; c++) {
    let base = forcedAt.get(c);
    if (!base) {
      let allowed = keys;
      if (melody && prev) {
        const d0 = diatonic(prev);
        const near = keys.filter((k) => {
          const d = Math.abs(diatonic(noteOf(k)) - d0);
          return d >= 1 && d <= 2;
        });
        if (near.length) allowed = near;
      }
      base = noteOf(pickWeighted(allowed, ctx.stats, ctx.now, recent, rng));
    }
    let column = [base];
    if (stacked && lv.id >= 3 && !forcedAt.has(c) && rng() < 0.3) {
      column = buildChord(base, rng() < 0.7 ? 2 : 3, pool, lv.maxFret, rng) ?? [base];
    }
    column.sort((a, b) => diatonic(b) - diatonic(a) || b.acc - a.acc);
    columns.push(column);
    recent.push(...column.map(key));
    prev = base;
  }
  return columns;
}

const HINT_DE = `<p><b>Linien</b> (von unten) E G H D F – „<b>E</b>s <b>g</b>eht <b>h</b>urtig <b>d</b>urch <b>F</b>leiß“.<br>
  <b>Zwischenräume</b> F A C E – „<b>F</b>ritz <b>a</b>ß <b>C</b>itronen-<b>E</b>is“.</p>`;
const HINT_EN = `<p><b>Linien</b> (von unten) E G B D F – „<b>E</b>very <b>g</b>ood <b>b</b>oy <b>d</b>oes <b>f</b>ine“.<br>
  <b>Zwischenräume</b> F A C E.</p>`;

function hint(lang: Lang): string {
  const h = lang === 'de' ? 'H' : 'B';
  return `${lang === 'de' ? HINT_DE : HINT_EN}
    <p>Leersaiten als Orientierung:</p>
    <table class="hint-table"><tbody>
      <tr><td>tiefes E</td><td>unter der 3. Hilfslinie</td></tr>
      <tr><td>A</td><td>auf der 2. Hilfslinie</td></tr>
      <tr><td>D</td><td>direkt unter dem System</td></tr>
      <tr><td>G</td><td>2. Linie</td></tr>
      <tr><td>${h}</td><td>Mittellinie</td></tr>
      <tr><td>hohes E</td><td>oberster Zwischenraum</td></tr>
    </tbody></table>`;
}

function buildQuestion(columns: Note[][], lv: Level, lang: Lang): NotesQuestion {
  const flat: Note[] = [];
  const fields: number[][] = columns.map((col) => col.map((n) => flat.push(n) - 1));
  const fieldItems = flat.map(key);
  const solutions = flat.map((n) => noteSolution(n, lang, lv.maxFret));
  const hasStacks = columns.some((c) => c.length > 1);
  return {
    kind: 'notes',
    prompt: hasStacks ? 'Benenne die Noten. Übereinander: von oben nach unten.' : 'Benenne die Noten.',
    items: [...new Set(fieldItems)],
    fieldItems,
    fields: flat.map((n) => ({ answer: { letter: n.letter, acc: n.acc } })),
    compare: 'exact',
    accidentals: lv.accidentals,
    staff: { columns, fields },
    partSolutions: solutions,
    explain: '<p>Gitarre klingt eine Oktave tiefer als notiert – deshalb die kleine 8 unter dem Violinschlüssel.</p>',
    solution: flat.map((n) => noteName(n, lang)).join(' '),
    hint: hint(lang),
    sound: columns.map((col) => col.map(soundingMidi)),
    fieldSounds: flat.map(soundingMidi),
  };
}

export const staffModule: ModuleDef = {
  id: 'staff',
  name: 'Noten lesen',
  desc: 'Eine Zeile Noten im Violinschlüssel benennen. Stehen Noten übereinander, von oben nach unten.',
  prefixes: ['staff:'],
  settings: [
    {
      id: 'level',
      label: 'Stufe',
      type: 'choice',
      options: LEVELS.map((l) => ({ value: String(l.id), label: `${l.id} · ${l.label}`, labelEn: l.labelEn ? `${l.id} · ${l.labelEn}` : undefined })),
      default: '1',
    },
    {
      id: 'perRow',
      label: 'Noten pro Zeile',
      type: 'choice',
      options: ['4', '8', '12', '16'].map((v) => ({ value: v, label: v })),
      default: '8',
    },
    { id: 'stacked', label: 'Noten übereinander (ab Stufe 3)', type: 'toggle', default: true },
    {
      id: 'order',
      label: 'Anordnung',
      type: 'choice',
      options: [
        { value: 'random', label: 'Zufall' },
        { value: 'melody', label: 'Melodie (kleine Schritte)' },
      ],
      default: 'random',
    },
    {
      ...COUNT_SETTING,
      label: 'Zeilen pro Runde',
      options: ['3', '5', '10', '20'].map((v) => ({ value: v, label: v })),
      default: '5',
    },
  ],
  count: (s) => Number(s.count ?? 5),
  keys: (s) => level(s).notes.map(key),
  make(settings, ctx) {
    const lv = level(settings);
    const forced = (ctx.forced ? ctx.forced.split(',') : []).map(noteOf);
    const length = Math.max(Number(settings.perRow ?? 8), forced.length);
    const columns = makeRow({
      level: lv,
      length,
      stacked: settings.stacked !== false,
      melody: settings.order === 'melody',
      forced,
      ctx,
    });
    return buildQuestion(columns, lv, ctx.lang);
  },
  groupForced(keys, settings) {
    const per = Number(settings.perRow ?? 8);
    const groups: string[] = [];
    for (let i = 0; i < keys.length; i += per) groups.push(keys.slice(i, i + per).join(','));
    return groups;
  },
  label(k, lang) {
    const n = noteOf(k);
    return `${noteName(n, lang)} · ${staffPositionText(n)}`;
  },
};
