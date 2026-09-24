import type { ItemStat } from '../learn/leitner';
import type { ModuleSettings } from '../learn/store';
import type { Lang } from '../music/names';
import type { Position, StringNo } from '../music/guitar';
import type { Note, Spelling } from '../music/notes';

export interface SettingOption {
  value: string;
  label: string;
  /** Beschriftung im Englisch-Modus (z. B. B statt H) */
  labelEn?: string;
}

export interface SettingDef {
  id: string;
  label: string;
  type: 'choice' | 'multi' | 'toggle';
  options?: SettingOption[];
  default: string | string[] | boolean;
}

export interface MakeContext {
  lang: Lang;
  /** Erzwungenes Element (Fehlerschleife, „Nur fällige“, „Fehler üben“) */
  forced?: string;
  /** zuletzt gefragte Elemente */
  recent: string[];
  stats: Record<string, ItemStat>;
  now: number;
  rng: () => number;
  /** Griffbrett-Ansicht für Grafiken, die schon beim Erzeugen gezeichnet werden */
  fretView?: 'low-bottom' | 'low-top';
}

interface QuestionBase {
  /** Aufgabentext */
  prompt: string;
  /** Element-Schlüssel, die diese Frage bewertet */
  items: string[];
  /** SVG/HTML der Grafik */
  figure?: string;
  /** ausklappbare Merkhilfe (HTML) */
  hint?: string;
  /** Erklärung nach dem Prüfen (HTML) */
  explain: string;
  /** kurze Lösung für die Fehlerliste, z. B. „5. Saite = A“ */
  solution: string;
  /** Zusatz nach jeder Antwort, z. B. eine Eselsbrücke (HTML) */
  after?: string;
  /** Klang zur Frage: Folge von Klängen (klingende MIDI-Werte) */
  sound?: number[][];
}

export interface NoteField {
  /** Beschriftung über dem Feld, z. B. „6.“ */
  label?: string;
  answer: Spelling;
}

export interface NotesQuestion extends QuestionBase {
  kind: 'notes';
  /** Griffbrett mit nummerierten Punkten (M4 „benennen“) */
  board?: BoardSpec & { points: Position[] };
  /** Klang je Feld (z. B. zum Antippen einer Note nach dem Prüfen) */
  fieldSounds?: number[];
  fields: NoteField[];
  /** exact = Schreibweise muss stimmen (Notensystem), pc = nur die Tonklasse */
  compare: 'exact' | 'pc';
  /** Reihenfolge egal (z. B. Akkordtöne) */
  unordered?: boolean;
  /** Vorzeichentasten zeigen */
  accidentals: boolean;
  /** Element je Feld, wenn jedes Feld ein eigenes Element ist (M2) */
  fieldItems?: string[];
  /** Klartext zu einer falschen Eingabe, z. B. „Das war Cis (A-Saite, 4. Bund).“ */
  describe?: (given: Spelling, field: number) => string;
  /** Lösung je Feld für Rückmeldung und Fehlerliste, z. B. „A · 2. Hilfslinie unten · A-Saite leer“ */
  partSolutions?: string[];
  /** Notenzeile (M2): Spalten von links nach rechts, in jeder Spalte die Töne von oben nach unten */
  staff?: { columns: Note[][]; fields: number[][] };
}

export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice';
  options: string[];
  correct: number;
  describe?: (given: number) => string;
}

/** Griffbrett-Ausschnitt einer Tipp-Frage */
export interface BoardSpec {
  from: number;
  to: number;
  /** antippbare Saiten; die anderen werden abgedunkelt */
  strings: StringNo[];
  /** feste Markierungen (z. B. nummerierte Punkte beim Benennen) */
  labels?: 'numbers' | 'names' | 'none';
  label: string;
}

export interface TapQuestion extends QuestionBase {
  kind: 'tap';
  board: BoardSpec;
  /** Mehrfachauswahl („alle Stellen finden“) */
  multi: boolean;
  /** richtige Stellen im Fenster */
  targets: Position[];
  /** weitere richtige Stellen außerhalb des Fensters, als Text */
  outside?: string;
  /** Klartext zur falschen Auswahl */
  describe?: (selected: Position[]) => string;
}

/** Antwort per Akkordtastatur: Grundton + Zusatz */
export interface ChordAnswer {
  root: Spelling | null;
  suffix: string | null;
}

export interface ChordQuestion extends QuestionBase {
  kind: 'chord';
  answer: { root: Spelling; suffix: string };
  describe?: (given: ChordAnswer) => string;
}

/** Griff setzen: Bund je Saite (tief → hoch), null = nicht gespielt */
export type ShapeAnswer = (number | null)[];

export interface ShapeQuestion extends QuestionBase {
  kind: 'shape';
  /** Prüfung des gesetzten Griffs */
  grade: (shape: ShapeAnswer) => boolean;
  /** Tonname je Saite für die Live-Anzeige */
  names: (shape: ShapeAnswer) => (string | null)[];
  /** Standardgriff für die Lösung */
  solutionShape: ShapeAnswer;
  solutionFingers?: string | null;
  describe?: (shape: ShapeAnswer) => string;
  /** Zusatz bei richtiger Antwort, z. B. „Umkehrung“ */
  noteOk?: (shape: ShapeAnswer) => string;
}

export type Question = NotesQuestion | ChoiceQuestion | TapQuestion | ChordQuestion | ShapeQuestion;

export type NotesAnswer = (Spelling | null)[];
export type TapAnswer = Position[];
export type Answer = NotesAnswer | TapAnswer | ChordAnswer | ShapeAnswer | number | null;

export interface ModuleDef {
  id: string;
  name: string;
  desc: string;
  /** Präfixe der Element-Schlüssel */
  prefixes: string[];
  settings: SettingDef[];
  count(settings: ModuleSettings): number;
  /** erlaubte Elemente bei diesen Einstellungen (manche hängen von der Sprache ab, z. B. H/B-Fragen) */
  keys(settings: ModuleSettings, lang?: Lang): string[];
  make(settings: ModuleSettings, ctx: MakeContext): Question;
  /** Bündelt erzwungene Elemente zu Fragen (M2: fällige Noten zu Zeilen); Einträge mit Komma getrennt */
  groupForced?(keys: string[], settings: ModuleSettings): string[];
  /** lesbarer Text für Auswertung und Statistik */
  label(key: string, lang: Lang): string;
}

export const COUNT_SETTING: SettingDef = {
  id: 'count',
  label: 'Fragen pro Runde',
  type: 'choice',
  options: [
    { value: '10', label: '10' },
    { value: '20', label: '20' },
    { value: '30', label: '30' },
  ],
  default: '20',
};

export function defaultSettings(defs: readonly SettingDef[]): ModuleSettings {
  return Object.fromEntries(defs.map((d) => [d.id, Array.isArray(d.default) ? [...d.default] : d.default]));
}
