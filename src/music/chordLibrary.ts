/**
 * Akkord-Bibliothek (Issue #12): alle 12 Grundtöne × 17 Akkordtypen mit geprüften Griffen.
 *
 * - Offene Griffe sind von Hand gepflegt (erste Lage, wie in gängigen Akkordsammlungen).
 * - Verschiebbare Griffe entstehen aus Vorlagen mit dem Grundton auf der tiefen E-Saite
 *   („E-Form“) oder auf der A-Saite („A-Form“), verschoben in den passenden Bund.
 * - Jeder Griff wird in den Unit-Tests gegen die Akkordformel geprüft (checkShape).
 *
 * Die Lernmodule (M5, Tabs, Akkordwechsel-Trainer) laden ihre Akkorde von hier.
 */
import { checkShape, parseChord, parseShape, shapeText, UG_ROOTS, type ChordSuffix, type Shape } from './chords';
import { mod } from './notes';

/** Akkordtypen in der Reihenfolge der Bibliothek, mit Namen. */
export const CHORD_TYPES: readonly { suffix: ChordSuffix; name: string }[] = [
  { suffix: '', name: 'Dur' },
  { suffix: 'm', name: 'Moll' },
  { suffix: '7', name: 'Sept (7)' },
  { suffix: 'm7', name: 'Moll-Sept (m7)' },
  { suffix: 'maj7', name: 'Major-Sept (maj7)' },
  { suffix: '6', name: 'Sext (6)' },
  { suffix: 'm6', name: 'Moll-Sext (m6)' },
  { suffix: '9', name: 'None (9)' },
  { suffix: 'sus2', name: 'sus2' },
  { suffix: 'sus4', name: 'sus4' },
  { suffix: '7sus4', name: '7sus4' },
  { suffix: 'add9', name: 'add9' },
  { suffix: 'dim', name: 'Vermindert (dim)' },
  { suffix: 'dim7', name: 'Vermindert-Sept (dim7)' },
  { suffix: 'aug', name: 'Übermäßig (aug)' },
  { suffix: 'm7b5', name: 'Halbvermindert (m7b5)' },
  { suffix: '5', name: 'Powerchord (5)' },
];

/** Form eines Griffs: offen (erste Lage) oder verschiebbar mit Grundton auf E- bzw. A-Saite. */
export type VoicingForm = 'open' | 'e' | 'a';

export interface Voicing {
  /** Griff wie „x32010“ oder „x-10-12-12-12-10“ */
  shape: string;
  /** Fingersatz, sofern gebräuchlich (Ziffern 1–4, 0 = leer, x = nicht gespielt) */
  fingers: string | null;
  form: VoicingForm;
  /** Bund des Grundtons bei verschiebbaren Griffen */
  fret?: number;
}

export interface LibraryChord {
  symbol: string;
  /** Index in UG_ROOTS (Tonklasse des Grundtons) */
  root: number;
  suffix: ChordSuffix;
  voicings: Voicing[];
}

type Open = [shape: string, fingers: string | null];

/** Offene Griffe (erste Lage). Der erste Griff je Akkord ist der Standardgriff. */
const OPEN: Record<string, Open[]> = {
  C: [['x32010', 'x32010']],
  C7: [['x32310', 'x32410']],
  Cmaj7: [['x32000', 'x32000']],
  C6: [['x32210', 'x42310']],
  Cadd9: [['x32030', null]],
  Csus2: [['x30013', null]],
  Csus4: [['x33011', 'x34011']],
  Caug: [['x32110', 'x32110']],
  D: [['xx0232', 'xx0132']],
  Dm: [['xx0231', 'xx0231']],
  D7: [['xx0212', 'xx0213']],
  Dm7: [['xx0211', 'xx0211']],
  Dmaj7: [['xx0222', 'xx0123']],
  D6: [['xx0202', null]],
  Dm6: [['xx0201', null]],
  Dsus2: [['xx0230', 'xx0130']],
  Dsus4: [['xx0233', 'xx0134']],
  D7sus4: [['xx0213', null]],
  Ddim: [['xx0131', null]],
  Ddim7: [['xx0101', null]],
  Daug: [['xx0332', null]],
  Dm7b5: [['xx0111', 'xx0111']],
  D5: [['xx023x', 'xx013x']],
  E: [['022100', '023100']],
  Em: [['022000', '023000']],
  E7: [['020100', '020100']],
  Em7: [
    ['022030', null],
    ['020000', '020000'],
  ],
  Emaj7: [['021100', '031200']],
  E6: [['022120', null]],
  Em6: [['022020', null]],
  E9: [['020102', null]],
  Esus4: [['022200', '023400']],
  E7sus4: [['020200', null]],
  Edim7: [['012020', null]],
  Eaug: [['032110', null]],
  E5: [['022xxx', '013xxx']],
  F: [['xx3211', 'xx3211']],
  Fmaj7: [['xx3210', 'xx3210']],
  Fsus2: [['xx3011', null]],
  G: [['320003', '210003']],
  G7: [['320001', '320001']],
  Gmaj7: [['320002', null]],
  G6: [['320000', '210000']],
  Gsus4: [['330013', null]],
  Gadd9: [['320203', null]],
  A: [['x02220', 'x01230']],
  Am: [['x02210', 'x02310']],
  A7: [['x02020', 'x02030']],
  Am7: [['x02010', 'x02010']],
  Amaj7: [['x02120', 'x02130']],
  A6: [['x02222', null]],
  Am6: [['x02212', null]],
  Asus2: [['x02200', 'x01200']],
  Asus4: [['x02230', null]],
  A7sus4: [['x02030', null]],
  Adim: [['x0121x', null]],
  Adim7: [['x01212', null]],
  Aaug: [['x03221', null]],
  A5: [['x022xx', 'x013xx']],
  B7: [['x21202', 'x21304']],
};

type Template = [offsets: (number | null)[], fingers: string | null];

/** Verschiebbare Griffe, Grundton auf der tiefen E-Saite (Bund f): Abstände zu f je Saite. */
const E_FORMS: Partial<Record<ChordSuffix, Template>> = {
  '': [[0, 2, 2, 1, 0, 0], '134211'],
  m: [[0, 2, 2, 0, 0, 0], '134111'],
  '7': [[0, 2, 0, 1, 0, 0], '131211'],
  m7: [[0, 2, 0, 0, 0, 0], '131111'],
  maj7: [[0, null, 1, 1, 0, null], null],
  '6': [[0, null, -1, 1, 0, null], null],
  m6: [[0, null, -1, 0, 0, null], null],
  '9': [[0, null, 0, 1, 0, 2], null],
  sus4: [[0, 2, 2, 2, 0, 0], '123411'],
  '7sus4': [[0, 2, 0, 2, 0, 0], '131411'],
  dim: [[0, 1, 2, 0, null, null], null],
  dim7: [[0, null, -1, 0, -1, null], null],
  aug: [[0, null, 2, 1, 1, null], null],
  m7b5: [[0, null, 0, 0, -1, null], null],
  '5': [[0, 2, 2, null, null, null], '134xxx'],
};

/** Verschiebbare Griffe, Grundton auf der A-Saite (Bund f). */
const A_FORMS: Partial<Record<ChordSuffix, Template>> = {
  '': [[null, 0, 2, 2, 2, 0], 'x12341'],
  m: [[null, 0, 2, 2, 1, 0], 'x13421'],
  '7': [[null, 0, 2, 0, 2, 0], 'x13141'],
  m7: [[null, 0, 2, 0, 1, 0], 'x13121'],
  maj7: [[null, 0, 2, 1, 2, 0], 'x13241'],
  '6': [[null, 0, 2, 2, 2, 2], null],
  m6: [[null, 0, null, -1, 1, 0], null],
  '9': [[null, 0, -1, 0, 0, null], null],
  sus2: [[null, 0, 2, 2, 0, 0], 'x13411'],
  sus4: [[null, 0, 2, 2, 3, 0], 'x12341'],
  '7sus4': [[null, 0, 2, 0, 3, 0], 'x13141'],
  add9: [[null, 0, -1, -3, 0, null], null],
  dim: [[null, 0, 1, 2, 1, null], null],
  dim7: [[null, 0, 1, -1, 1, null], null],
  aug: [[null, 0, -1, -2, -2, null], null],
  m7b5: [[null, 0, 1, 0, 1, null], null],
  '5': [[null, 0, 2, 2, null, null], 'x134xx'],
};

/** höchster Bund, den die Bibliothek verwendet */
const MAX_FRET = 15;

function place(t: Template, rootFret: number): Shape | null {
  for (const f of [rootFret, rootFret + 12]) {
    if (f < 1) continue;
    const shape = t[0].map((o) => (o === null ? null : f + o));
    const frets = shape.filter((x): x is number => x !== null);
    if (Math.min(...frets) >= 0 && Math.max(...frets) <= MAX_FRET) return shape;
  }
  return null;
}

function movable(t: Template | undefined, rootFret: number, form: 'e' | 'a'): Voicing | null {
  if (!t) return null;
  const shape = place(t, rootFret);
  if (!shape) return null;
  return { shape: shapeText(shape), fingers: t[1], form, fret: form === 'e' ? shape[0]! : shape[1]! };
}

function build(): LibraryChord[] {
  const out: LibraryChord[] = [];
  UG_ROOTS.forEach((rootName, pc) => {
    for (const { suffix } of CHORD_TYPES) {
      const symbol = rootName + suffix;
      const voicings: Voicing[] = (OPEN[symbol] ?? []).map(([shape, fingers]) => ({ shape, fingers, form: 'open' }));
      const e = movable(E_FORMS[suffix], mod(pc - 4, 12), 'e');
      const a = movable(A_FORMS[suffix], mod(pc - 9, 12), 'a');
      // tiefere Lage zuerst
      for (const v of [e, a].filter((x): x is Voicing => x !== null).sort((x, y) => x.fret! - y.fret!)) {
        if (!voicings.some((w) => w.shape === v.shape)) voicings.push(v);
      }
      out.push({ symbol, root: pc, suffix, voicings });
    }
  });
  return out;
}

export const LIBRARY: readonly LibraryChord[] = build();

export function libraryChord(symbol: string): LibraryChord | undefined {
  return LIBRARY.find((c) => c.symbol === symbol);
}

/** Griff-Kennung für Trainer und Links: „C#m@x46654“ */
export function voicingId(symbol: string, v: Voicing): string {
  return `${symbol}@${v.shape}`;
}

/** Kurzbeschreibung eines Griffs, z. B. „offen“ oder „Grundton E-Saite, 5. Bund“. */
export function voicingLabel(v: Voicing): string {
  if (v.form === 'open') return 'offen';
  return `Grundton ${v.form === 'e' ? 'E' : 'A'}-Saite, ${v.fret}. Bund`;
}

/** höchster gegriffener Bund */
export function maxFret(v: Voicing): number {
  return Math.max(0, ...parseShape(v.shape).filter((x): x is number => x !== null));
}

/** Prüfung eines Bibliotheksgriffs (für Tests und Entwicklung). */
export function voicingOk(c: LibraryChord, v: Voicing): boolean {
  return checkShape(parseShape(v.shape), parseChord(c.symbol)).ok;
}

/* ------------------------------------------------------------------ */
/* Lern-Sätze (M5, Tabs, Akkordwechsel) – geladen aus der Bibliothek   */
/* ------------------------------------------------------------------ */

export type ChordSet = 'basic' | 'plus' | 'seven' | 'barre' | 'dm24' | 'all';

export interface ChordDef {
  id: string;
  /** Sätze, zu denen der Akkord gehört (Auswahl in M5) */
  sets: ChordSet[];
  symbol: string;
  /** Anzeigename, wenn es mehrere Griffe gibt: „F (klein)“, „F (Barré)“. */
  label: string;
  shape: string;
  fingers: string | null;
}

/** Griff aus der Bibliothek holen; unbekannte Griffe sind ein Programmierfehler. */
function fromLibrary(symbol: string, shape?: string): Voicing {
  const c = libraryChord(symbol);
  const v = shape ? c?.voicings.find((x) => x.shape === shape) : c?.voicings[0];
  if (!v) throw new Error(`Griff fehlt in der Bibliothek: ${symbol} ${shape ?? ''}`);
  return v;
}

/** [id, Satz, Symbol, Griff, Anzeigename] – die bisherigen Lernsätze (Kennungen bleiben für den Lernstand gleich) */
const BASE: [string, ChordSet, string, string, string?][] = [
  ['A', 'basic', 'A', 'x02220'],
  ['D', 'basic', 'D', 'xx0232'],
  ['E', 'basic', 'E', '022100'],
  ['Am', 'basic', 'Am', 'x02210'],
  ['Em', 'basic', 'Em', '022000'],
  ['Dm', 'basic', 'Dm', 'xx0231'],
  ['G', 'basic', 'G', '320003'],
  ['C', 'basic', 'C', 'x32010'],
  ['Fs', 'plus', 'F', 'xx3211', 'F (klein)'],
  ['Fmaj7', 'plus', 'Fmaj7', 'xx3210'],
  ['Cadd9', 'plus', 'Cadd9', 'x32030'],
  ['Dsus4', 'plus', 'Dsus4', 'xx0233'],
  ['Dsus2', 'plus', 'Dsus2', 'xx0230'],
  ['Asus2', 'plus', 'Asus2', 'x02200'],
  ['Asus4', 'plus', 'Asus4', 'x02230'],
  ['Em7', 'plus', 'Em7', '022030'],
  ['Am7', 'plus', 'Am7', 'x02010'],
  ['Cmaj7', 'plus', 'Cmaj7', 'x32000'],
  ['E7', 'seven', 'E7', '020100'],
  ['A7', 'seven', 'A7', 'x02020'],
  ['D7', 'seven', 'D7', 'xx0212'],
  ['G7', 'seven', 'G7', '320001'],
  ['C7', 'seven', 'C7', 'x32310'],
  ['B7', 'seven', 'B7', 'x21202'],
  ['Fb', 'barre', 'F', '133211', 'F (Barré)'],
  ['Bm', 'barre', 'Bm', 'x24432'],
  ['E5', 'barre', 'E5', '022xxx'],
  ['A5', 'barre', 'A5', 'x022xx'],
];

function learnSets(): ChordDef[] {
  const defs: ChordDef[] = BASE.map(([id, set, symbol, shape, label]) => {
    const v = fromLibrary(symbol, shape);
    return { id, sets: [set], symbol, label: label ?? symbol, shape: v.shape, fingers: v.fingers };
  });
  const add = (symbol: string, set: ChordSet) => {
    // F als ganzer Akkord: der Barré-Griff (die kleine F-Form ist ein eigener Lernschritt)
    const id = symbol === 'F' ? 'Fb' : symbol;
    const known = defs.find((d) => d.id === id);
    if (known) {
      if (!known.sets.includes(set)) known.sets.push(set);
      return;
    }
    const v = fromLibrary(symbol);
    defs.push({ id, sets: [set], symbol, label: symbol, shape: v.shape, fingers: v.fingers });
  };
  for (const c of LIBRARY) {
    if (c.suffix === '' || c.suffix === 'm') add(c.symbol, 'dm24');
    add(c.symbol, 'all');
  }
  return defs;
}

/** Akkorde der Lernmodule, jeweils mit ihrem Standardgriff aus der Bibliothek. */
export const CHORDS: readonly ChordDef[] = learnSets();

/** Griff für Trainer & Co.: Lern-Kennung („A“, „Fs“) oder Bibliotheks-Kennung („C#m@x46654“). */
export interface Grip {
  id: string;
  symbol: string;
  label: string;
  shape: string;
  fingers: string | null;
}

export function gripById(id: string | undefined): Grip | undefined {
  if (!id) return undefined;
  const def = CHORDS.find((c) => c.id === id);
  if (def) return { id, symbol: def.symbol, label: def.label, shape: def.shape, fingers: def.fingers };
  const [symbol = '', shape = ''] = id.split('@');
  const c = libraryChord(symbol);
  const v = c?.voicings.find((x) => x.shape === shape);
  if (!c || !v) return undefined;
  const standard = c.voicings[0] === v;
  return { id, symbol, label: standard ? symbol : `${symbol} (${v.form === 'open' ? 'offen' : `${v.fret}. Bund`})`, shape: v.shape, fingers: v.fingers };
}
