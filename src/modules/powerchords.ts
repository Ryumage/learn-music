import { pickWeighted } from '../learn/picker';
import type { ModuleSettings } from '../learn/store';
import { checkShape, parseChord, shapeMidi, shapeText, UG_ROOTS, type Shape } from '../music/chords';
import { fretDerivation, openPitchClass, positionText, stringName, stringNameDative, type StringNo } from '../music/guitar';
import { noteName, pitchClassLabel, type Lang } from '../music/names';
import { LETTER_STEPS, mod } from '../music/notes';
import { renderChordShape } from '../render/chordDiagram';
import { fretWindow } from '../render/fretboard';
import { renderTab } from '../render/tab';
import { esc } from '../util/html';
import { shapeNames } from './chords';
import { COUNT_SETTING, type MakeContext, type ModuleDef, type Question } from './types';

/** Saiten, auf denen der Grundton liegen kann: tiefe E-, A- und D-Saite */
export type RootString = 6 | 5 | 4;
const ROOT_STRINGS: RootString[] = [6, 5, 4];

type Task = 'name' | 'shape' | 'find' | 'know';
const TASKS: Task[] = ['name', 'shape', 'find', 'know'];
const PREFIX: Record<Task, string> = { name: 'pwn:', shape: 'pws:', find: 'pwf:', know: 'pwk:' };

export const PW_RANGES: Record<string, [number, number]> = { '0-5': [0, 5], '0-7': [0, 7], '0-12': [0, 12] };

/**
 * Powerchord-Griff mit Oktave (drei Saiten).
 * Grundton auf E/A: Quinte eine Saite höher +2, Oktave zwei Saiten höher +2.
 * Grundton auf D: die Oktave liegt auf der H-Saite +3 (H-Saite ist eine große Terz zur G-Saite gestimmt).
 */
export function powerShape(s: RootString, f: number): Shape {
  if (s === 6) return [f, f + 2, f + 2, null, null, null];
  if (s === 5) return [null, f, f + 2, f + 2, null, null];
  return [null, null, f, f + 2, f + 3, null];
}

export function powerFingers(s: RootString, f: number): string {
  const three = f === 0 ? '013' : '134';
  if (s === 6) return `${three}xxx`;
  if (s === 5) return `x${three}xx`;
  return `xx${three}x`;
}

/** Name wie auf Ultimate Guitar: „G5“, „F#5“, „Bb5“. */
export function powerSymbol(s: RootString, f: number): string {
  return `${UG_ROOTS[mod(openPitchClass(s) + f, 12)]}5`;
}

const isNatural = (pc: number) => (LETTER_STEPS as readonly number[]).includes(mod(pc, 12));

/** Powerchord-Griff prüfen: Grundton + Quinte (Oktave erlaubt), Grundton auf der verlangten Saite im Bass. */
export function powerOk(shape: Shape, s: RootString, symbol: string): boolean {
  const played = shape.filter((f) => f !== null).length;
  const lowest = shape.findIndex((f) => f !== null);
  if (played < 2 || lowest !== 6 - s) return false;
  const r = checkShape(shape, parseChord(symbol));
  return r.ok && !r.inversion;
}

/** Wissensfragen (PLAN-Ergänzung, Issue #15) */
const KNOW: Record<string, { prompt: string; correct: string; wrong: string[]; explain: string }> = {
  tones: {
    prompt: 'Aus welchen Tönen besteht ein Powerchord?',
    correct: 'Grundton und Quinte (oft plus Oktave)',
    wrong: ['Grundton, Terz und Quinte', 'Grundton und große Terz', 'Grundton, Quarte und Quinte'],
    explain: 'Ein Powerchord hat nur <b>Grundton und Quinte</b>, meist mit der Oktave des Grundtons obendrauf.',
  },
  majmin: {
    prompt: 'Ist ein Powerchord Dur oder Moll?',
    correct: 'Weder noch – die Terz fehlt',
    wrong: ['Immer Dur', 'Immer Moll', 'Das hängt vom Bund ab'],
    explain: 'Dur oder Moll entscheidet die <b>Terz</b>. Die fehlt im Powerchord – deshalb passt er zu Dur- und Moll-Songs.',
  },
  fifth: {
    prompt: 'Grundton auf der tiefen E-Saite: Wo liegt die Quinte?',
    correct: 'Eine Saite höher, zwei Bünde weiter',
    wrong: ['Eine Saite höher, im selben Bund', 'Zwei Saiten höher, im selben Bund', 'Eine Saite tiefer, zwei Bünde weiter'],
    explain: 'Die Quinte liegt auf der <b>nächsthöheren Saite, zwei Bünde weiter</b> – Ringfinger.',
  },
  octave: {
    prompt: 'Grundton auf der A-Saite: Wo liegt die Oktave?',
    correct: 'Zwei Saiten höher, zwei Bünde weiter',
    wrong: ['Eine Saite höher, drei Bünde weiter', 'Zwei Saiten höher, im selben Bund', 'Drei Saiten höher, zwei Bünde weiter'],
    explain: 'Die Oktave liegt <b>zwei Saiten höher, zwei Bünde weiter</b> – derselbe Bund wie die Quinte, kleiner Finger.',
  },
  dstring: {
    prompt: 'Grundton auf der D-Saite: Wo liegt die Oktave?',
    correct: 'Auf der H-Saite, drei Bünde weiter',
    wrong: ['Auf der H-Saite, zwei Bünde weiter', 'Auf der G-Saite, zwei Bünde weiter', 'Auf der hohen E-Saite, im selben Bund'],
    explain: 'Die H-Saite ist eine große Terz über der G-Saite gestimmt. Deshalb rutscht die Oktave dort <b>einen Bund weiter: drei statt zwei</b>.',
  },
  symbol: {
    prompt: 'Wie steht der Powerchord auf A im Songbook?',
    correct: 'A5',
    wrong: ['A', 'Am', 'A7'],
    explain: 'Powerchords schreibt man mit einer <b>5</b> – für Grundton und Quinte: A5, E5, F#5.',
  },
  pm: {
    prompt: 'Was bedeutet „P.M.“ über Powerchords im Tab?',
    correct: 'Palm Mute: Handballen am Steg, abgedämpft',
    wrong: ['Pause machen', 'Plektrum mittig anschlagen', 'Powerchord mit Moll-Terz'],
    explain: '<b>Palm Mute</b>: den Handballen der Schlaghand leicht auf die Saiten am Steg legen – der typische, „chuggende“ Metal-Sound.',
  },
  distortion: {
    prompt: 'Warum klingen Powerchords mit viel Verzerrung so sauber?',
    correct: 'Grundton und Quinte vertragen die Verzerrung, die Terz würde mulmig klingen',
    wrong: ['Weil sie immer leer gespielt werden', 'Weil sie nur auf der hohen E-Saite liegen', 'Weil die Verzerrung die Quinte entfernt'],
    explain: 'Verzerrung erzeugt viele Obertöne. Bei <b>Grundton und Quinte</b> passen sie zusammen, mit der Terz entstehen Reibungen. Darum: Powerchords für Rock und Metal.',
  },
  dropd: {
    prompt: 'Drop-D-Stimmung: Was ändert sich?',
    correct: 'Tiefe E-Saite auf D – Powerchords mit einem Finger',
    wrong: ['Alle Saiten einen Ganzton tiefer', 'Die hohe E-Saite auf D', 'Nichts, nur der Name'],
    explain: 'Bei <b>Drop D</b> wird die tiefe E-Saite einen Ganzton tiefer auf D gestimmt. Dann liegen Grundton, Quinte und Oktave auf den drei tiefen Saiten im selben Bund – ein Finger reicht.',
  },
};
const KNOW_IDS = Object.keys(KNOW);

interface Cfg {
  tasks: Task[];
  strings: RootString[];
  range: [number, number];
  accidentals: boolean;
}

function cfg(s: ModuleSettings): Cfg {
  const tasks = ((s.tasks as Task[] | undefined)?.length ? s.tasks : TASKS) as Task[];
  const strings = ((s.strings as string[] | undefined) ?? ['6', '5']).map(Number).filter((n) => ROOT_STRINGS.includes(n as RootString)) as RootString[];
  return {
    tasks,
    strings: strings.length ? strings : [6, 5],
    range: PW_RANGES[(s.frets as string) ?? '0-7'] ?? [0, 7],
    accidentals: s.accidentals === true,
  };
}

export function powerKeys(s: ModuleSettings): string[] {
  const c = cfg(s);
  const keys: string[] = [];
  for (const t of c.tasks) {
    if (t === 'know') {
      keys.push(...KNOW_IDS.map((id) => PREFIX.know + id));
      continue;
    }
    for (const str of c.strings) {
      for (let f = c.range[0]; f <= c.range[1]; f++) {
        if (c.accidentals || isNatural(openPitchClass(str) + f)) keys.push(`${PREFIX[t]}${str}:${f}`);
      }
    }
  }
  return keys;
}

function diagram(s: RootString, f: number, label: string): string {
  return renderChordShape({ shape: powerShape(s, f), fingers: powerFingers(s, f), label });
}

function tabColumn(s: RootString, f: number, lang: Lang): string {
  const shape = powerShape(s, f);
  const notes = shape.flatMap((fr, i) => (fr === null ? [] : [{ string: (6 - i) as StringNo, text: String(fr) }]));
  return renderTab({ columns: [{ notes }], names: true, lang, label: `Tab mit Powerchord ${shapeText(shape)}` });
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function rule(s: RootString): string {
  return s === 4
    ? 'Grundton auf der D-Saite, Quinte auf der G-Saite zwei Bünde weiter, Oktave auf der H-Saite <b>drei</b> Bünde weiter.'
    : `Grundton auf der ${s === 6 ? 'tiefen E' : 'A'}-Saite, Quinte eine Saite höher zwei Bünde weiter, Oktave zwei Saiten höher zwei Bünde weiter.`;
}

function build(key: string, c: Cfg, ctx: MakeContext): Question {
  const { lang, rng } = ctx;
  const prefix = key.slice(0, 4);
  if (prefix === PREFIX.know) {
    const k = KNOW[key.slice(4)]!;
    const options = shuffle([k.correct, ...k.wrong], rng);
    return {
      kind: 'choice',
      prompt: k.prompt,
      items: [key],
      options,
      correct: options.indexOf(k.correct),
      explain: `<p>${k.explain}</p>`,
      solution: k.correct,
    };
  }

  const [sArg, fArg] = key.slice(4).split(':');
  const s = Number(sArg) as RootString;
  const f = Number(fArg);
  const symbol = powerSymbol(s, f);
  const shape = powerShape(s, f);
  const root = parseChord(symbol).root;
  const sound = [shapeMidi(shape)];
  const where = positionText({ string: s, fret: f }, lang);
  const explain = `<p>${esc(fretDerivation({ string: s, fret: f }, lang))}</p>
    <p>Grundton ${esc(noteName(root, lang))} → <b>${esc(symbol)}</b>. ${rule(s)}</p>`;

  if (prefix === PREFIX.name) {
    const asTab = rng() < 0.5;
    return {
      kind: 'notes',
      prompt: asTab ? 'Welcher Powerchord steht im Tab? Nenne den Grundton.' : 'Welcher Powerchord ist das? Nenne den Grundton.',
      items: [key],
      figure: asTab ? tabColumn(s, f, lang) : diagram(s, f, `Akkorddiagramm Powerchord ${shapeText(shape)}`),
      fields: [{ answer: root }],
      compare: 'pc',
      accidentals: c.accidentals,
      describe: (given) => {
        const pc = mod(LETTER_STEPS[given.letter]! + given.acc, 12);
        return `Das wäre ${UG_ROOTS[pc]}5. Der tiefste Ton (${stringName(s, lang)}, ${f === 0 ? 'leer' : `${f}. Bund`}) ist ${pitchClassLabel(openPitchClass(s) + f, lang)}.`;
      },
      explain,
      solution: `${shapeText(shape)} = ${symbol}`,
      sound,
    };
  }

  if (prefix === PREFIX.shape) {
    return {
      kind: 'shape',
      prompt: `Setze ${symbol} mit Grundton auf der ${stringNameDative(s, lang)}.`,
      items: [key],
      grade: (sh) => powerOk(sh, s, symbol),
      names: (sh) => shapeNames(sh, parseChord(symbol), lang),
      solutionShape: shape,
      solutionFingers: powerFingers(s, f),
      describe: (sh) => {
        const lowest = sh.findIndex((x) => x !== null);
        if (sh.filter((x) => x !== null).length < 2) return 'Ein Powerchord braucht mindestens zwei Saiten: Grundton und Quinte.';
        if (lowest !== 6 - s) return `Der Grundton gehört auf die ${stringName(s, lang)} – die tieferen Saiten bleiben stumm (×).`;
        const r = checkShape(sh, parseChord(symbol));
        if (r.inversion) return `Auf der ${stringNameDative(s, lang)} liegt nicht ${noteName(root, lang)}.`;
        if (r.foreign.length) return `Gehört nicht dazu: ${r.foreign.map((pc) => pitchClassLabel(pc, lang)).join(', ')}. Nur Grundton und Quinte!`;
        return `Es fehlt: ${r.missing.map((pc) => pitchClassLabel(pc, lang)).join(', ')}.`;
      },
      noteOk: (sh) => (sh.filter((x) => x !== null).length === 2 ? 'Richtig – mit der Oktave dazu (drei Saiten) klingt er noch voller.' : ''),
      explain: `${explain}${diagram(s, f, `Powerchord ${symbol}`)}`,
      solution: `${symbol}: ${shapeText(shape)}`,
      sound,
    };
  }

  // Grundton auf dem Griffbrett finden
  const window = fretWindow(c.range, f, rng);
  const targets = [f, f + 12, f - 12]
    .filter((x) => x >= window[0] && x <= window[1] && x >= 0)
    .map((fret) => ({ string: s as StringNo, fret }));
  return {
    kind: 'tap',
    prompt: `Wo liegt der Grundton von ${symbol} auf der ${stringNameDative(s, lang)}? Tippe ihn an.`,
    items: [key],
    board: { from: window[0], to: window[1], strings: [s], labels: 'names', label: `Griffbrett, nur ${stringName(s, lang)} antippbar` },
    multi: false,
    targets,
    describe: (sel) => {
      const p = sel[0];
      return p ? `Dort liegt ${pitchClassLabel(openPitchClass(s) + p.fret, lang)} – das wäre ${powerSymbol(s, p.fret)}.` : '';
    },
    explain: `${explain}${diagram(s, f, `Powerchord ${symbol}`)}`,
    solution: `${symbol}: ${where}`,
    sound,
  };
}

const HINT = `<p><b>Powerchord = Grundton + Quinte</b> (+ Oktave). Geschrieben mit 5: G5, A5, F#5.</p>
  <p>Grundton auf E- oder A-Saite: Quinte eine Saite höher, zwei Bünde weiter; Oktave zwei Saiten höher, zwei Bünde weiter. Auf der D-Saite liegt die Oktave drei Bünde weiter (H-Saite).</p>
  <p>Den Namen gibt der Grundton: Griffbrett-Wissen aus M4 hilft.</p>`;

/** Einführung auf der Startseite des Moduls: erklären und zeigen (Issue #15). */
function intro(lang: Lang): string {
  const card = (s: RootString, f: number) =>
    `<figure class="pw-shape">${diagram(s, f, `Powerchord ${powerSymbol(s, f)}`)}<figcaption><b>${esc(powerSymbol(s, f))}</b><br><span class="muted small">Grundton ${esc(stringName(s, lang))}</span></figcaption></figure>`;
  const riff: [RootString, number][] = [
    [6, 0],
    [6, 3],
    [6, 5],
    [6, 0],
    [6, 6],
    [6, 5],
  ];
  const seq = riff.map(([s, f]) => shapeMidi(powerShape(s, f)).join(',')).join(';');
  const riffTab = renderTab({
    columns: riff.map(([s, f]) => ({
      notes: powerShape(s, f).flatMap((fr, i) => (fr === null ? [] : [{ string: (6 - i) as StringNo, text: String(fr) }])),
    })),
    above: [{ from: 0, to: riff.length - 1, text: 'P.M.', line: true }],
    names: true,
    lang,
    label: 'Riff mit Powerchords E5 G5 A5 E5 Bb5 A5',
  });
  return `<h2 class="card-title">So funktionieren Powerchords 🤘</h2>
    <p>Ein Powerchord besteht nur aus <b>Grundton und Quinte</b>, oft mit der Oktave obendrauf. Ohne Terz ist er weder Dur noch Moll – und klingt mit Verzerrung druckvoll und sauber. Darum ist er das Werkzeug für Rock, Punk und Metal.</p>
    <div class="pw-shapes">${card(6, 3)}${card(5, 3)}${card(4, 3)}</div>
    <p class="small">Die Form bleibt gleich – du verschiebst sie nur. Der Name kommt vom Grundton: Bund 3 auf der tiefen E-Saite ist G, also G5. Auf der D-Saite rutscht die Oktave einen Bund weiter (H-Saite).</p>
    <div class="figure">${riffTab}</div>
    <p class="pw-riff"><button type="button" class="btn btn-small" data-action="play-seq" data-seq="${seq}" data-gap="0.32">▶ Riff anhören</button>
      <span class="muted small">E5 – G5 – A5 – E5 – Bb5 – A5, mit Palm Mute (Handballen am Steg)</span></p>`;
}

export const powerModule: ModuleDef = {
  id: 'power',
  name: 'Powerchords',
  desc: 'Grundton + Quinte: Powerchords erkennen, greifen und auf dem Griffbrett finden – für Rock und Metal.',
  prefixes: Object.values(PREFIX),
  intro,
  settings: [
    {
      id: 'tasks',
      label: 'Aufgaben',
      type: 'multi',
      options: [
        { value: 'name', label: 'Erkennen (Diagramm/Tab)' },
        { value: 'shape', label: 'Griff setzen' },
        { value: 'find', label: 'Grundton finden' },
        { value: 'know', label: 'Wissen' },
      ],
      default: [...TASKS],
    },
    {
      id: 'strings',
      label: 'Grundton auf',
      type: 'multi',
      options: [
        { value: '6', label: 'tiefer E-Saite', labelEn: 'tiefer E-Saite' },
        { value: '5', label: 'A-Saite' },
        { value: '4', label: 'D-Saite' },
      ],
      default: ['6', '5'],
    },
    {
      id: 'frets',
      label: 'Bünde',
      type: 'choice',
      options: Object.keys(PW_RANGES).map((v) => ({ value: v, label: v.replace('-', '–') })),
      default: '0-7',
    },
    { id: 'accidentals', label: 'Mit ♯/♭ (z. B. F#5)', type: 'toggle', default: false },
    COUNT_SETTING,
  ],
  count: (s) => Number(s.count ?? 20),
  keys: (s) => powerKeys(s),
  make(settings, ctx) {
    const c = cfg(settings);
    const key = ctx.forced ?? pickWeighted(powerKeys(settings), ctx.stats, ctx.now, ctx.recent, ctx.rng);
    return { ...build(key, c, ctx), hint: HINT };
  },
  label(key, lang) {
    const prefix = key.slice(0, 4);
    if (prefix === PREFIX.know) return `Wissen: ${KNOW[key.slice(4)]?.prompt ?? key}`;
    const [sArg, fArg] = key.slice(4).split(':');
    const s = Number(sArg) as RootString;
    const f = Number(fArg);
    const t = `${powerSymbol(s, f)} (${positionText({ string: s, fret: f }, lang)})`;
    return prefix === PREFIX.name ? `Erkennen: ${t}` : prefix === PREFIX.shape ? `Griff: ${t}` : `Grundton finden: ${t}`;
  },
};

