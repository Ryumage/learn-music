import type { ItemStat } from '../learn/leitner';
import type { ModuleSettings } from '../learn/store';
import type { Lang } from '../music/names';
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
}

export interface NoteField {
  /** Beschriftung über dem Feld, z. B. „6.“ */
  label?: string;
  answer: Spelling;
}

export interface NotesQuestion extends QuestionBase {
  kind: 'notes';
  fields: NoteField[];
  /** exact = Schreibweise muss stimmen (Notensystem), pc = nur die Tonklasse */
  compare: 'exact' | 'pc';
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

export type Question = NotesQuestion | ChoiceQuestion;

export type NotesAnswer = (Spelling | null)[];
export type Answer = NotesAnswer | number | null;

export interface ModuleDef {
  id: string;
  name: string;
  desc: string;
  /** Präfixe der Element-Schlüssel */
  prefixes: string[];
  settings: SettingDef[];
  count(settings: ModuleSettings): number;
  /** erlaubte Elemente bei diesen Einstellungen */
  keys(settings: ModuleSettings): string[];
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
