import { pickWeighted } from '../learn/picker';
import type { ModuleSettings } from '../learn/store';
import {
  fretDerivation,
  fretMidi,
  openPitchClass,
  positionText,
  stringName,
  stringNameDative,
  STRINGS,
  type Position,
  type StringNo,
} from '../music/guitar';
import { pitchClassLabel } from '../music/names';
import { fromMidi, LETTER_STEPS, mod } from '../music/notes';
import { fretWindow } from '../render/fretboard';
import { esc } from '../util/html';
import { COUNT_SETTING, type MakeContext, type ModuleDef, type Question } from './types';

type Task = 'name' | 'find' | 'all';
const TASKS: Task[] = ['name', 'find', 'all'];

export const RANGES: Record<string, [number, number]> = {
  '0-4': [0, 4],
  '0-7': [0, 7],
  '5-12': [5, 12],
  '0-12': [0, 12],
};

const isNatural = (pc: number) => (LETTER_STEPS as readonly number[]).includes(mod(pc, 12));

export function pcAt(s: StringNo, fret: number): number {
  return mod(openPitchClass(s) + fret, 12);
}

interface Cfg {
  tasks: Task[];
  strings: StringNo[];
  range: [number, number];
  accidentals: boolean;
  multiPoints: boolean;
}

function cfg(s: ModuleSettings): Cfg {
  const task = (s.task as string) ?? 'mixed';
  const strings = ((s.strings as string[] | undefined) ?? ['6', '5']).map(Number) as StringNo[];
  return {
    tasks: task === 'mixed' ? TASKS : [task as Task],
    strings: strings.length ? strings : [6, 5],
    range: RANGES[(s.frets as string) ?? '0-4'] ?? [0, 4],
    accidentals: s.accidentals === true,
    multiPoints: s.points === '2-4',
  };
}

function allowedPositions(c: Cfg, strings: readonly StringNo[] = c.strings): Position[] {
  const out: Position[] = [];
  for (const s of strings) {
    for (let f = c.range[0]; f <= c.range[1]; f++) if (c.accidentals || isNatural(pcAt(s, f))) out.push({ string: s, fret: f });
  }
  return out;
}

function keysFor(c: Cfg): string[] {
  const keys: string[] = [];
  const pos = allowedPositions(c);
  for (const t of c.tasks) {
    if (t === 'name') keys.push(...pos.map((p) => `fret:${p.string}:${p.fret}`));
    if (t === 'find') keys.push(...pos.map((p) => `find:${p.string}:${p.fret}`));
    if (t === 'all') keys.push(...[...new Set(pos.map((p) => pcAt(p.string, p.fret)))].sort((a, b) => a - b).map((pc) => `fall:${pc}`));
  }
  return keys;
}

const inWindow = (w: [number, number], f: number) => f >= w[0] && f <= w[1];

/** Welcher Bund auf dieser Saite hat diese Tonklasse (möglichst im Fenster)? */
function fretFor(s: StringNo, pc: number, w: [number, number]): number {
  const base = mod(pc - openPitchClass(s), 12);
  for (const f of [base, base + 12]) if (inWindow(w, f)) return f;
  return base;
}

const RULES = '<p>1 Bund = 1 Halbton. Halbtonschritte ohne Vorzeichen gibt es nur bei E–F und H–C.</p>';

export const OCTAVE_HINT = `<p><b>Oktav-Trick</b></p>
  <ul>
    <li>Von der tiefen E- und A-Saite: 2 Saiten höher, 2 Bünde weiter.</li>
    <li>Von der D- und G-Saite: 2 Saiten höher, 3 Bünde weiter.</li>
    <li>Von der H-Saite: 3 Saiten tiefer (A-Saite), 2 Bünde weiter.</li>
    <li>12. Bund = Oktave der Leersaite.</li>
  </ul>`;

function nameQuestion(key: string, c: Cfg, ctx: MakeContext): Question {
  const { lang, rng } = ctx;
  const [, sArg, fArg] = key.split(':');
  const first: Position = { string: Number(sArg) as StringNo, fret: Number(fArg) };
  const window = fretWindow(c.range, first.fret, rng);
  const points: Position[] = [first];
  if (c.multiPoints) {
    const want = 2 + Math.floor(rng() * 3);
    const candidates = allowedPositions(c).filter((p) => inWindow(window, p.fret) && p.string !== first.string);
    while (points.length < want && candidates.length) {
      const [p] = candidates.splice(Math.floor(rng() * candidates.length), 1);
      if (!points.some((q) => q.string === p!.string)) points.push(p!);
    }
  }
  const keys = points.map((p) => `fret:${p.string}:${p.fret}`);
  const multi = points.length > 1;
  const derivations = points.map((p) => fretDerivation(p, lang));
  return {
    kind: 'notes',
    prompt: multi ? 'Wie heißen die markierten Töne?' : 'Wie heißt der markierte Ton?',
    items: keys,
    fieldItems: multi ? keys : undefined,
    fields: points.map((p, i) => {
      const n = fromMidi(fretMidi(p.string, p.fret));
      return { label: multi ? `${i + 1}.` : undefined, answer: { letter: n.letter, acc: n.acc } };
    }),
    compare: 'pc',
    accidentals: c.accidentals,
    board: { from: window[0], to: window[1], strings: [], labels: 'names', label: 'Griffbrett mit markierten Tönen', points },
    describe: (given, i) => {
      const p = points[i]!;
      const pc = mod(LETTER_STEPS[given.letter]! + given.acc, 12);
      const f = fretFor(p.string, pc, window);
      return `${multi ? `${i + 1}.: ` : ''}Das war ${pitchClassLabel(pc, lang)} (${positionText({ string: p.string, fret: f }, lang)}).`;
    },
    partSolutions: multi ? derivations : undefined,
    explain: `${derivations.map((d) => `<p>${esc(d)}</p>`).join('')}${RULES}`,
    solution: points.map((p) => `${positionText(p, lang)} = ${pitchClassLabel(pcAt(p.string, p.fret), lang)}`).join(', '),
    sound: points.map((p) => [fretMidi(p.string, p.fret)]),
    fieldSounds: points.map((p) => fretMidi(p.string, p.fret)),
    hint: OCTAVE_HINT,
  };
}

function findQuestion(key: string, c: Cfg, ctx: MakeContext): Question {
  const { lang, rng } = ctx;
  const [, sArg, fArg] = key.split(':');
  const s = Number(sArg) as StringNo;
  const target: Position = { string: s, fret: Number(fArg) };
  const pc = pcAt(s, target.fret);
  const window = fretWindow(c.range, target.fret, rng);
  const targets: Position[] = [];
  for (let f = window[0]; f <= window[1]; f++) if (pcAt(s, f) === pc && inWindow(c.range, f)) targets.push({ string: s, fret: f });
  const label = pitchClassLabel(pc, lang);
  return {
    kind: 'tap',
    prompt: `Tippe ${label} auf der ${stringNameDative(s, lang)}.`,
    items: [key],
    board: { from: window[0], to: window[1], strings: [s], labels: 'names', label: `Griffbrett, nur ${stringName(s, lang)} antippbar` },
    multi: false,
    targets,
    describe: (sel) => {
      const p = sel[0];
      return p ? `Das war ${pitchClassLabel(pcAt(p.string, p.fret), lang)} (${positionText(p, lang)}).` : '';
    },
    explain: `${targets.map((t) => `<p>${esc(fretDerivation(t, lang))}</p>`).join('')}${RULES}`,
    solution: `${label} auf der ${stringNameDative(s, lang)} = ${targets.map((t) => (t.fret === 0 ? 'leer' : `${t.fret}. Bund`)).join(' / ')}`,
    sound: [[fretMidi(s, target.fret)]],
    hint: OCTAVE_HINT,
  };
}

function allQuestion(key: string, c: Cfg, ctx: MakeContext): Question {
  const { lang, rng } = ctx;
  const pc = Number(key.split(':')[1]);
  const everywhere = allowedPositions({ ...c, accidentals: true }).filter((p) => pcAt(p.string, p.fret) === pc);
  const anchor = everywhere[Math.floor(rng() * everywhere.length)] ?? { string: c.strings[0]!, fret: c.range[0] };
  const window = fretWindow(c.range, anchor.fret, rng);
  const targets = everywhere.filter((p) => inWindow(window, p.fret));
  const label = pitchClassLabel(pc, lang);
  const where = c.strings.length === 1 ? `auf der ${stringNameDative(c.strings[0]!, lang)}` : 'auf den hellen Saiten';
  return {
    kind: 'tap',
    prompt: `Tippe alle ${label} ${where}.`,
    items: [key],
    board: { from: window[0], to: window[1], strings: [...c.strings], labels: 'names', label: 'Griffbrett, markierte Saiten antippbar' },
    multi: true,
    targets,
    describe: (sel) => {
      const hits = sel.filter((p) => targets.some((t) => t.string === p.string && t.fret === p.fret)).length;
      const wrong = sel.length - hits;
      return `${hits} von ${targets.length} gefunden${wrong ? `, ${wrong} falsch getippt` : ''}.`;
    },
    explain: `<p>${esc(label)}: ${targets.map((t) => esc(positionText(t, lang))).join(' · ')}</p>${OCTAVE_HINT}`,
    solution: `${label}: ${targets.map((t) => positionText(t, lang)).join(', ')}`,
    sound: [targets.map((t) => fretMidi(t.string, t.fret))],
  };
}

export const fretboardModule: ModuleDef = {
  id: 'fret',
  name: 'Griffbrett',
  desc: 'Töne auf dem Griffbrett benennen, auf einer Saite finden und alle Stellen eines Tons finden.',
  prefixes: ['fret:', 'find:', 'fall:'],
  settings: [
    {
      id: 'task',
      label: 'Aufgabe',
      type: 'choice',
      options: [
        { value: 'name', label: 'Benennen' },
        { value: 'find', label: 'Auf einer Saite finden' },
        { value: 'all', label: 'Alle Stellen finden' },
        { value: 'mixed', label: 'Gemischt' },
      ],
      default: 'mixed',
    },
    {
      id: 'strings',
      label: 'Saiten',
      type: 'multi',
      options: STRINGS.map((s) => ({ value: String(s), label: `${s}. ${s === 6 ? '(tiefe E)' : s === 1 ? '(hohe E)' : ''}`.trim() })),
      default: ['6', '5'],
    },
    {
      id: 'frets',
      label: 'Bünde',
      type: 'choice',
      options: Object.keys(RANGES).map((v) => ({ value: v, label: v.replace('-', '–') })),
      default: '0-4',
    },
    { id: 'accidentals', label: 'Mit ♯/♭', type: 'toggle', default: false },
    {
      id: 'points',
      label: 'Punkte beim Benennen',
      type: 'choice',
      options: [
        { value: '1', label: '1' },
        { value: '2-4', label: '2–4' },
      ],
      default: '1',
    },
    COUNT_SETTING,
  ],
  count: (s) => Number(s.count ?? 20),
  keys: (s) => keysFor(cfg(s)),
  make(settings, ctx) {
    const c = cfg(settings);
    const key = ctx.forced ?? pickWeighted(keysFor(c), ctx.stats, ctx.now, ctx.recent, ctx.rng);
    if (key.startsWith('find:')) return findQuestion(key, c, ctx);
    if (key.startsWith('fall:')) return allQuestion(key, c, ctx);
    return nameQuestion(key, c, ctx);
  },
  label(key, lang) {
    const [kind, a, b] = key.split(':');
    if (kind === 'fall') return `Alle ${pitchClassLabel(Number(a), lang)} finden`;
    const p: Position = { string: Number(a) as StringNo, fret: Number(b) };
    return kind === 'find'
      ? `${pitchClassLabel(pcAt(p.string, p.fret), lang)} auf der ${stringNameDative(p.string, lang)} finden`
      : `${positionText(p, lang)} benennen`;
  },
};
