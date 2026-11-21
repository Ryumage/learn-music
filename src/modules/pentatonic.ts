import { pickWeighted } from '../learn/picker';
import type { ModuleSettings } from '../learn/store';
import { parseChord, UG_ROOTS } from '../music/chords';
import { stringName, type Position } from '../music/guitar';
import { noteName, type Lang } from '../music/names';
import {
  DEGREE_LABELS,
  degreeOf,
  PATTERN_COUNT,
  patternPositions,
  patternSpan,
  pentaName,
  PENTA_STEPS,
  positionMidi,
  positionPc,
  scaleNoteName,
  type PentaType,
} from '../music/pentatonic';
import { renderFretboard, samePosition, type FretMarker } from '../render/fretboard';
import { esc } from '../util/html';
import { COUNT_SETTING, type MakeContext, type ModuleDef, type Question } from './types';

type Task = 'tap' | 'which' | 'degree';
const TASKS: Task[] = ['tap', 'which', 'degree'];
const PREFIX: Record<Task, string> = { tap: 'pnt:', which: 'pnw:', degree: 'pnd:' };

/** Grundton-Auswahl: „A“, im Deutsch-Modus „B (H)“ und „Bb (B)“ */
export function rootLabel(pc: number, lang: Lang): string {
  const name = UG_ROOTS[pc]!;
  if (lang !== 'de') return name;
  const de = noteName(parseChord(name).root, 'de');
  return de === name ? name : `${name} (${de})`;
}

interface Cfg {
  type: PentaType;
  root: number;
  patterns: number[];
  tasks: Task[];
}

function cfg(s: ModuleSettings): Cfg {
  const root = Number(s.root ?? 9);
  const patterns = ((s.patterns as string[] | undefined) ?? []).map(Number).filter((n) => n >= 1 && n <= PATTERN_COUNT);
  const tasks = ((s.tasks as Task[] | undefined)?.length ? s.tasks : TASKS) as Task[];
  return {
    type: s.type === 'major' ? 'major' : 'minor',
    root: Number.isInteger(root) && root >= 0 && root < 12 ? root : 9,
    patterns: patterns.length ? patterns : [1, 2, 3, 4, 5],
    tasks,
  };
}

export function pentaKeys(s: ModuleSettings): string[] {
  const c = cfg(s);
  return c.tasks.flatMap((t) => c.patterns.map((n) => `${PREFIX[t]}${c.type}:${c.root}:${n}`));
}

/** Griffbrett-Ausschnitt um ein Pattern: ein Bund Luft auf beiden Seiten */
export function patternWindow(ps: readonly Position[]): [number, number] {
  const [lo, hi] = patternSpan(ps);
  return [Math.max(0, lo - 1), hi + 1];
}

export interface PatternView {
  type: PentaType;
  root: number;
  n: number;
  lang: Lang;
  view?: 'low-bottom' | 'low-top';
  /** Beschriftung der Punkte */
  labels: 'degree' | 'note' | 'none';
  label: string;
  /** zusätzliche Markierung, z. B. „?“ */
  mark?: Position;
}

/** Pattern als Griffbrett mit Punkten; Grundtöne hervorgehoben. */
export function renderPattern(v: PatternView): string {
  const ps = patternPositions(v.type, v.root, v.n);
  const [from, to] = patternWindow(ps);
  const markers: FretMarker[] = ps.map((p) => {
    const pc = positionPc(p);
    const degree = degreeOf(v.type, v.root, pc)!;
    const isMark = v.mark && samePosition(v.mark, p);
    const text = isMark ? '?' : v.labels === 'degree' ? degree : v.labels === 'note' ? scaleNoteName(v.type, v.root, pc, v.lang) : undefined;
    return { ...p, text, state: isMark ? 'active' : degree === '1' && v.labels !== 'none' ? 'root' : null };
  });
  return renderFretboard({ from, to, view: v.view, labels: 'names', markers, lang: v.lang, label: v.label });
}

function stringsText(type: PentaType, root: number, ps: readonly Position[], lang: Lang): string {
  return [6, 5, 4, 3, 2, 1]
    .map((s) => {
      const onString = ps.filter((p) => p.string === s);
      const notes = onString.map((p) => `${p.fret === 0 ? 'leer' : p.fret} (${scaleNoteName(type, root, positionPc(p), lang)}, ${degreeOf(type, root, positionPc(p))})`);
      return `<li>${esc(stringName(s as 1, lang))}: ${esc(notes.join(' · '))}</li>`;
    })
    .join('');
}

function pickOne<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)]!;
}

function build(key: string, ctx: MakeContext): Question {
  const { lang, rng } = ctx;
  const prefix = key.slice(0, 4);
  const [typeArg, rootArg, nArg] = key.slice(4).split(':');
  const type: PentaType = typeArg === 'major' ? 'major' : 'minor';
  const root = Number(rootArg);
  const n = Number(nArg);
  const ps = patternPositions(type, root, n);
  const [from, to] = patternWindow(ps);
  const name = pentaName(type, root, lang);
  const [lo, hi] = patternSpan(ps);
  const sound = ps.map((p) => [positionMidi(p)]);
  const overview = `<p><b>Pattern ${n}</b> der ${esc(name)} (Bund ${lo}–${hi}):</p><ul class="penta-strings">${stringsText(type, root, ps, lang)}</ul>`;
  const solutionBoard = `<div class="figure">${renderPattern({ type, root, n, lang, view: ctx.fretView, labels: 'degree', label: `Pattern ${n}` })}</div>`;

  if (prefix === PREFIX.tap) {
    return {
      kind: 'tap',
      prompt: `Tippe alle Töne von Pattern ${n} der ${name}.`,
      items: [key],
      board: { from, to, strings: [6, 5, 4, 3, 2, 1], labels: 'names', label: `Griffbrett Bund ${from}–${to}, alle Saiten antippbar` },
      multi: true,
      targets: ps,
      describe: (sel) => {
        const hits = sel.filter((p) => ps.some((t) => samePosition(t, p))).length;
        const wrong = sel.length - hits;
        return `${hits} von ${ps.length} Tönen getroffen${wrong ? `, ${wrong} gehören nicht dazu` : ''}.`;
      },
      explain: overview,
      solution: `Pattern ${n}, ${name}: Bund ${lo}–${hi}`,
      sound,
    };
  }

  if (prefix === PREFIX.which) {
    const options = Array.from({ length: PATTERN_COUNT }, (_, i) => `Pattern ${i + 1}`);
    return {
      kind: 'choice',
      prompt: `Welches Pattern der ${name} ist das?`,
      items: [key],
      figure: renderPattern({ type, root, n, lang, view: ctx.fretView, labels: 'degree', label: `Pentatonik-Pattern im Bund ${lo}–${hi}` }),
      options,
      correct: n - 1,
      describe: (g) => {
        const [a, b] = patternSpan(patternPositions(type, root, g + 1));
        return `Pattern ${g + 1} liegt bei Bund ${a}–${b}.`;
      },
      explain: `${overview}<p class="small muted">Tipp: Merke dir, wo der Grundton (1) in jedem Pattern liegt.</p>`,
      solution: `Bund ${lo}–${hi} = Pattern ${n}`,
      sound,
    };
  }

  // Stufe eines markierten Tons
  const mark = pickOne(ps, rng);
  const pc = positionPc(mark);
  const degree = degreeOf(type, root, pc)!;
  const options = [...DEGREE_LABELS[type]];
  return {
    kind: 'choice',
    prompt: `Welche Stufe der ${name} ist der markierte Ton?`,
    items: [key],
    figure: renderPattern({ type, root, n, lang, view: ctx.fretView, labels: 'none', mark, label: `Pattern ${n}, ein Ton markiert` }),
    options,
    correct: options.indexOf(degree),
    describe: (g) => `Stufe ${options[g]} wäre der Ton ${scaleNoteName(type, root, (root + PENTA_STEPS[type][g]!) % 12, lang)}.`,
    explain: `<p>Markiert: <b>${esc(scaleNoteName(type, root, pc, lang))}</b> (${esc(stringName(mark.string, lang))}, ${mark.fret === 0 ? 'leer' : `${mark.fret}. Bund`}) = Stufe <b>${esc(degree)}</b>.</p>${solutionBoard}`,
    solution: `${scaleNoteName(type, root, pc, lang)} = Stufe ${degree}`,
    sound: [[positionMidi(mark)]],
  };
}

const HINT = `<p><b>Moll-Pentatonik:</b> 1 ♭3 4 5 ♭7 · <b>Dur-Pentatonik:</b> 1 2 3 5 6.</p>
  <p>Fünf Patterns mit je zwei Tönen pro Saite decken den ganzen Hals ab. Pattern 1 beginnt mit dem Moll-Grundton auf der tiefen E-Saite; die Dur-Pentatonik nutzt die Patterns ihrer parallelen Moll-Tonart (C-Dur = a-Moll).</p>`;

export const pentaModule: ModuleDef = {
  id: 'penta',
  name: 'Pentatonik',
  desc: 'Die fünf Patterns der Pentatonik greifen und erkennen – in jeder Tonart, Moll und Dur.',
  prefixes: Object.values(PREFIX),
  intro: () =>
    `<p>Zum Ansehen und Anhören aller Patterns gibt es das Werkzeug <a href="#/penta">Pentatonik-Patterns</a>. Hier übst du sie: greifen, erkennen und die Stufen benennen.</p>`,
  settings: [
    {
      id: 'type',
      label: 'Tonleiter',
      type: 'choice',
      options: [
        { value: 'minor', label: 'Moll-Pentatonik' },
        { value: 'major', label: 'Dur-Pentatonik' },
      ],
      default: 'minor',
    },
    {
      id: 'root',
      label: 'Grundton',
      type: 'choice',
      options: UG_ROOTS.map((_, pc) => ({ value: String(pc), label: rootLabel(pc, 'de'), labelEn: rootLabel(pc, 'en') })),
      default: '9',
    },
    {
      id: 'patterns',
      label: 'Patterns',
      type: 'multi',
      options: Array.from({ length: PATTERN_COUNT }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
      default: ['1', '2', '3', '4', '5'],
    },
    {
      id: 'tasks',
      label: 'Aufgaben',
      type: 'multi',
      options: [
        { value: 'tap', label: 'Pattern greifen' },
        { value: 'which', label: 'Pattern erkennen' },
        { value: 'degree', label: 'Stufe benennen' },
      ],
      default: [...TASKS],
    },
    COUNT_SETTING,
  ],
  count: (s) => Number(s.count ?? 20),
  keys: (s) => pentaKeys(s),
  make(settings, ctx) {
    const key = ctx.forced ?? pickWeighted(pentaKeys(settings), ctx.stats, ctx.now, ctx.recent, ctx.rng);
    return { ...build(key, ctx), hint: HINT };
  },
  label(key, lang) {
    const [typeArg, rootArg, nArg] = key.slice(4).split(':');
    const name = pentaName(typeArg === 'major' ? 'major' : 'minor', Number(rootArg), lang);
    const what = key.startsWith(PREFIX.tap) ? 'greifen' : key.startsWith(PREFIX.which) ? 'erkennen' : 'Stufen';
    return `${name}, Pattern ${nArg}: ${what}`;
  },
};
