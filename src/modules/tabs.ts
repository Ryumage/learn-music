import { pickWeighted, shuffle } from '../learn/picker';
import type { ModuleSettings } from '../learn/store';
import {
  capoChain,
  capoSounding,
  chordSpoken,
  chordSymbol,
  chordTones,
  CHORDS,
  parseChord,
  parseShape,
  shapeMidi,
  shapeString,
  type ChordSymbol,
} from '../music/chords';
import { fretDerivation, fretMidi, positionText, stringName, STRINGS, type StringNo } from '../music/guitar';
import { noteName, type Lang } from '../music/names';
import { fromMidi } from '../music/notes';
import { renderTab, renderTextTab, type TabColumn } from '../render/tab';
import { esc } from '../util/html';
import { chordById, chordExplain, chordTitle } from './chords';
import { COUNT_SETTING, type MakeContext, type ModuleDef, type Question } from './types';

type Topic = 'basics' | 'tech' | 'chords';
const TOPICS: Topic[] = ['basics', 'tech', 'chords'];

/** Wissensfragen zu Grundlagen (PLAN M6). */
const KNOW = ['bar', 'zero', 'stack', 'top', 'fret'] as const;
type Know = (typeof KNOW)[number];

/** Spieltechniken in Text-Tabs (PLAN M6). */
export const TECHNIQUES = {
  h: { sign: '5h7', label: 'Hammer-on (Aufschlagbindung)', how: 'Nur den ersten Ton anschlagen, dann mit einem Finger auf den höheren Bund „hämmern“.' },
  p: { sign: '7p5', label: 'Pull-off (Abzugbindung)', how: 'Beide Bünde greifen, den höheren anschlagen und den Finger seitlich von der Saite abziehen.' },
  su: { sign: '5/7', label: 'Slide aufwärts', how: 'Anschlagen und mit dem Finger auf der Saite zum höheren Bund rutschen.' },
  sd: { sign: '7\\5', label: 'Slide abwärts', how: 'Anschlagen und mit dem Finger auf der Saite zum tieferen Bund rutschen.' },
  b: { sign: '7b9', label: 'Bending (Saite ziehen)', how: 'Die Saite ziehen, bis der Ton wie Bund 9 klingt (2 Bünde = „full“).' },
  br: { sign: '7b9r7', label: 'Bending mit Release', how: 'Hochziehen wie Bund 9 und ohne neuen Anschlag zurücklassen.' },
  v: { sign: '5~~', label: 'Vibrato', how: 'Den Ton mit kleinen, schnellen Zieh-Bewegungen schwingen lassen.' },
  x: { sign: 'x', label: 'Dead Note (Klick ohne Ton)', how: 'Die Saite nur leicht berühren und anschlagen: ein Klick ohne Tonhöhe.' },
  pm: { sign: 'PM----', label: 'Palm Mute (mit dem Handballen dämpfen)', how: 'Den Handballen am Steg auf die Saiten legen; gilt über die Länge der Linie.' },
  harm: { sign: '<12>', label: 'Flageolett', how: 'Den Finger leicht über dem Bundstäbchen auflegen, nicht drücken.' },
  ring: { sign: 'let ring', label: 'Töne ausklingen lassen', how: 'Die gegriffenen Töne nicht abdämpfen, sondern weiterklingen lassen.' },
} as const;
type Tech = keyof typeof TECHNIQUES;
const TECH_IDS = Object.keys(TECHNIQUES) as Tech[];

const ARCS = ['tie', 'h', 'p'] as const;
type Arc = (typeof ARCS)[number];
const ARC_LABEL: Record<Arc, string> = { tie: 'Haltebogen (nicht neu anschlagen)', h: 'Hammer-on', p: 'Pull-off' };

/** Capo-Shapes (PLAN M6). */
export const CAPO_SHAPES = ['G', 'C', 'D', 'Em', 'Am', 'A', 'E', 'Dm'];
const STACK_CHORDS = CHORDS.filter((c) => c.set === 'basic' || c.set === 'seven').map((c) => c.id);
const HB = ['Bm', 'B7', 'Bb', 'B'] as const;
const HB_SHAPES: Record<(typeof HB)[number], string> = { Bm: 'x24432', B7: 'x21202', Bb: 'x13331', B: 'x24442' };

function topics(s: ModuleSettings): Topic[] {
  const t = s.topics as Topic[] | undefined;
  return t?.length ? t : TOPICS;
}

export function tabKeys(s: ModuleSettings, lang: Lang = 'de'): string[] {
  const keys: string[] = [];
  for (const t of topics(s)) {
    if (t === 'basics') {
      keys.push(...STRINGS.map((st) => `tab:line:${st}`), ...STRINGS.map((st) => `tab:note:${st}`), ...KNOW.map((k) => `tab:know:${k}`));
    }
    if (t === 'tech') keys.push(...TECH_IDS.map((k) => `tab:tech:${k}`), ...ARCS.map((a) => `tab:arc:${a}`));
    if (t === 'chords') {
      keys.push(
        ...STACK_CHORDS.map((id) => `tab:stack:${id}`),
        ...CAPO_SHAPES.map((id) => `tab:capo:${id}`),
        ...CAPO_SHAPES.map((id) => `tab:cfret:${id}`),
        'tab:head:tuning',
        'tab:head:capo',
      );
      // H/B-Fangfragen nur im Deutsch-Modus
      if (lang === 'de') keys.push(...HB.map((b) => `tab:hb:${b}`));
    }
  }
  return keys;
}

const pick = <T>(list: readonly T[], rng: () => number): T => list[Math.floor(rng() * list.length)]!;

/** Auswahl aus richtiger Antwort und bis zu 3 Ablenkern, gemischt. */
function options(correct: string, others: readonly string[], rng: () => number, n = 4): { options: string[]; correct: number } {
  const distractors = shuffle(
    others.filter((o) => o !== correct),
    rng,
  ).slice(0, n - 1);
  const all = shuffle([correct, ...distractors], rng);
  return { options: all, correct: all.indexOf(correct) };
}

/** UG-Saitenbuchstaben von oben nach unten. */
const UG_LETTERS: Record<StringNo, string> = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };

/** Text-Tab mit 6 Zeilen; `parts` = Inhalt je Saite, alle gleich lang mit „-“ aufgefüllt. */
export function textTab(parts: Partial<Record<StringNo, string>>, above?: string): string[] {
  const len = Math.max(...Object.values(parts).map((p) => p!.length), 3) + 6;
  const lines = ([1, 2, 3, 4, 5, 6] as StringNo[]).map((s) => {
    const body = `---${parts[s] ?? ''}`;
    return `${UG_LETTERS[s]}|${body.padEnd(len, '-')}|`;
  });
  return above ? [`  ${above}`, ...lines] : lines;
}

function techFigure(t: Tech, rng: () => number): string {
  const s = pick<StringNo>([2, 3, 4], rng);
  let parts: Partial<Record<StringNo, string>>;
  let above: string | undefined;
  switch (t) {
    case 'x':
      parts = { 6: 'x-x-3-', 5: 'x-x---' };
      break;
    case 'pm':
      parts = { 6: '0-0-0-0-' };
      above = '  PM------|';
      break;
    case 'ring':
      parts = { 3: '0-----', 2: '--1---', 1: '----0-' };
      above = '  let ring--------|';
      break;
    case 'harm':
      parts = { 3: '<12>--', 2: '<12>--', 1: '<12>--' };
      break;
    default:
      parts = { [s]: `${TECHNIQUES[t].sign}--` };
  }
  return renderTextTab(textTab(parts, above), `Text-Tab mit dem Zeichen ${TECHNIQUES[t].sign}`);
}

const ORDINAL_EN = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

function chordAnswerDescribe(lang: Lang) {
  return (g: { root: ChordSymbol['root'] | null; suffix: string | null }) => {
    if (!g.root) return '';
    const given = { root: g.root, suffix: (g.suffix ?? '') as ChordSymbol['suffix'] };
    const tones = chordTones(given).map((t) => noteName(t, lang)).join(' ');
    return `Das wäre ${chordTitle(given, chordSymbol(given), lang)} mit den Tönen ${tones}.`;
  };
}

/** kurzes Riff auf einer Saite, eine Zahl markiert */
function riff(rng: () => number): { frets: number[]; mark: number } {
  const n = 4 + Math.floor(rng() * 3);
  const frets = Array.from({ length: n }, () => Math.floor(rng() * 8));
  return { frets, mark: Math.floor(rng() * n) };
}

const BASICS_HINT = `<p>Oben im Tab ist die <b>hohe e-Saite</b>, unten die tiefe E-Saite. Die Zahl ist der <b>Bund</b>, 0 = Leersaite.</p>
  <p>Senkrechte Striche sind <b>Taktstriche</b>. Übereinander = gleichzeitig.</p>`;
const TECH_HINT = `<p>h = Hammer-on, p = Pull-off, / \\ = Slide, b = Bending, r = Release, ~ = Vibrato, x = Dead Note, PM = Palm Mute, &lt;12&gt; = Flageolett.</p>
  <p><b>Klammern ( )</b> bedeuten je nach Quelle etwas anderes – meist einen leisen „Geisterton“ oder einen Ton, der vom Bending noch klingt. Nicht überbewerten.</p>`;
const CHORDS_HINT = `<p>Capo hebt alles um einen Halbton pro Bund: G-Griff mit Capo 2 klingt als A (G → Ab → A).</p>
  <p>Bund für den Capo = Abstand in Halbtönen vom Griff zum Zielakkord.</p>`;

function build(key: string, ctx: MakeContext): Question {
  const { lang, rng } = ctx;
  const [, type, a] = key.split(':') as [string, string, string];

  if (type === 'line') {
    const s = Number(a) as StringNo;
    const opts = STRINGS.slice()
      .reverse()
      .map((n) => `${n}. Saite (${stringName(n, lang)})`);
    return {
      kind: 'choice',
      prompt: 'Welche Saite ist die markierte Tab-Linie?',
      items: [key],
      figure: renderTab({ highlight: s, lang, label: `Tab, ${7 - s}. Linie von unten markiert` }),
      options: opts,
      correct: s - 1,
      describe: (g) => `Die ${g + 1}. Saite (${stringName((g + 1) as StringNo, lang)}) ist die ${g + 1}. Linie von oben.`,
      explain: `<p>Die markierte Linie ist die <b>${s}. Saite (${esc(stringName(s, lang))})</b>.</p><p>Im Tab ist <b>oben die hohe e-Saite</b> – die dünnste Saite.</p>`,
      solution: `Tab-Linie ${s} von oben = ${s}. Saite`,
      hint: BASICS_HINT,
    };
  }

  if (type === 'note') {
    const s = Number(a) as StringNo;
    const r = riff(rng);
    const f = r.frets[r.mark]!;
    const n = fromMidi(fretMidi(s, f));
    const columns: TabColumn[] = r.frets.map((fr, i) => ({ notes: [{ string: s, text: String(fr), mark: i === r.mark }] }));
    return {
      kind: 'notes',
      prompt: 'Welcher Ton ist die markierte Zahl?',
      items: [key],
      figure: renderTab({ columns, names: true, lang, label: `Tab-Riff auf der ${stringName(s, lang)}, Bund ${f} markiert` }),
      fields: [{ answer: { letter: n.letter, acc: n.acc } }],
      compare: 'pc',
      accidentals: true,
      explain: `<p>${esc(fretDerivation({ string: s, fret: f }, lang))}</p><p>Die Zahl im Tab ist der <b>Bund</b>, die Linie die Saite.</p>`,
      solution: `${positionText({ string: s, fret: f }, lang)} = ${noteName(n, lang)}`,
      sound: r.frets.map((fr) => [fretMidi(s, fr)]),
      hint: BASICS_HINT,
    };
  }

  if (type === 'know') {
    const k = a as Know;
    const q = KNOW_Q[k];
    const o = options(q.correct, q.wrong, rng);
    return {
      kind: 'choice',
      prompt: q.prompt,
      items: [key],
      figure: q.figure(lang),
      ...o,
      explain: `<p>${q.explain}</p>`,
      solution: `${q.short}: ${q.correct}`,
      hint: BASICS_HINT,
    };
  }

  if (type === 'tech') {
    const t = a as Tech;
    const info = TECHNIQUES[t];
    const o = options(info.label, TECH_IDS.map((id) => TECHNIQUES[id].label), rng);
    return {
      kind: 'choice',
      prompt: t === 'pm' || t === 'ring' ? 'Was bedeutet die Angabe über dem Tab?' : `Was bedeutet „${info.sign}“ im Tab?`,
      items: [key],
      figure: techFigure(t, rng),
      ...o,
      describe: (g) => {
        const other = TECH_IDS.find((id) => TECHNIQUES[id].label === o.options[g]);
        return other ? `${TECHNIQUES[other].label} schreibt man „${TECHNIQUES[other].sign}“.` : '';
      },
      explain: `<p><b>${esc(info.sign)}</b> = ${esc(info.label)}.</p><p>So spielst du es: ${esc(info.how)}</p>`,
      solution: `${info.sign} = ${info.label}`,
      hint: TECH_HINT,
    };
  }

  if (type === 'arc') {
    const t = a as Arc;
    const s = pick<StringNo>([1, 2, 3, 4], rng);
    const f1 = t === 'p' ? 5 + Math.floor(rng() * 5) : 2 + Math.floor(rng() * 6);
    const f2 = t === 'tie' ? f1 : t === 'h' ? f1 + 2 : f1 - 2;
    const columns: TabColumn[] = [
      { notes: [{ string: s, text: String(f1) }] },
      { notes: [{ string: s, text: String(f2) }] },
    ];
    const o = options(ARC_LABEL[t], [...Object.values(ARC_LABEL), 'Slide aufwärts'], rng);
    const rule =
      t === 'tie'
        ? 'Gleiche Zahl mit Bogen = <b>Haltebogen</b>: den Ton nicht neu anschlagen, er klingt einfach weiter.'
        : t === 'h'
          ? 'Zweite Zahl höher mit Bogen = <b>Hammer-on</b>: nur den ersten Ton anschlagen, den zweiten aufschlagen.'
          : 'Zweite Zahl tiefer mit Bogen = <b>Pull-off</b>: den höheren Ton anschlagen, den Finger seitlich abziehen.';
    return {
      kind: 'choice',
      prompt: 'Was bedeutet der Bogen?',
      items: [key],
      figure: renderTab({ columns, arcs: [{ string: s, from: 0, to: 1 }], lang, label: `Tab mit Bogen von ${f1} nach ${f2}` }),
      ...o,
      explain: `<p>${rule}</p><p>In offiziellen Tabs steht oft kein H oder P – dann entscheidet die Richtung.</p>`,
      solution: `Bogen ${f1} → ${f2} = ${ARC_LABEL[t]}`,
      hint: `<p>Gleiche Zahl = Haltebogen · höher = Hammer-on · tiefer = Pull-off.</p>`,
    };
  }

  if (type === 'stack') {
    const def = chordById(a)!;
    const shape = parseShape(def.shape);
    const c = parseChord(def.symbol);
    const notes = shape.flatMap((f, i) => (f === null ? [] : [{ string: shapeString(i), text: String(f) }]));
    return {
      kind: 'chord',
      prompt: 'Welcher Akkord steht in dieser Spalte?',
      items: [key],
      figure: renderTab({ columns: [{ notes }], names: true, lang, label: `Tab mit gestapelter Spalte ${def.shape}` }),
      answer: { root: c.root, suffix: c.suffix },
      describe: chordAnswerDescribe(lang),
      explain: `<p>Von der tiefen E- zur hohen e-Saite gelesen: <b>${esc(def.shape)}</b> – das ist der Griff für ${esc(def.label)}.</p>${chordExplain(def, lang)}`,
      solution: `${def.shape} = ${def.symbol}`,
      sound: [shapeMidi(shape)],
      hint: `<p>Übereinander stehende Zahlen werden <b>gleichzeitig</b> gespielt. Unten im Tab ist die tiefe E-Saite – lies von unten nach oben wie im Griffbild von links nach rechts.</p>`,
    };
  }

  if (type === 'capo') {
    const capo = 1 + Math.floor(rng() * 7);
    const sounding = capoSounding(a, capo);
    const c = parseChord(sounding);
    const def = chordById(a)!;
    const shape = parseShape(def.shape).map((f) => (f === null ? null : f + capo));
    return {
      kind: 'chord',
      prompt: `Capo im ${capo}. Bund, du greifst ${a} – was klingt?`,
      items: [key],
      figure: renderTextTab([`Capo: ${ORDINAL_EN[capo]} fret`, '', `[Intro]`, `${a}`], `Kopfzeile Capo ${capo}, Akkord ${a}`),
      answer: { root: c.root, suffix: c.suffix },
      describe: chordAnswerDescribe(lang),
      explain: `<p>Jeder Bund hebt um einen Halbton: <b>${esc(capoChain(a, capo))}</b>.</p><p>${esc(a)}-Griff mit Capo ${capo} klingt als <b>${esc(chordTitle(c, sounding, lang))}</b>.</p>`,
      solution: `Capo ${capo} + ${a}-Griff = ${sounding}`,
      sound: [shapeMidi(shape)],
      hint: CHORDS_HINT,
    };
  }

  if (type === 'cfret') {
    const capo = 1 + Math.floor(rng() * 7);
    const target = capoSounding(a, capo);
    const opts = [1, 2, 3, 4, 5, 6, 7].map((n) => `${n}. Bund`);
    return {
      kind: 'choice',
      prompt: `Der Song klingt in ${target}. Du willst ${a}-Griffe spielen – in welchen Bund kommt der Capo?`,
      items: [key],
      options: opts,
      correct: capo - 1,
      describe: (g) => `Capo im ${g + 1}. Bund mit ${a}-Griff klingt als ${capoSounding(a, g + 1)}.`,
      explain: `<p>Von ${esc(a)} bis ${esc(target)} in Halbtönen: <b>${esc(capoChain(a, capo))}</b> = ${capo} ${capo === 1 ? 'Bund' : 'Bünde'}.</p>`,
      solution: `${target} mit ${a}-Griffen = Capo ${capo}`,
      hint: CHORDS_HINT,
    };
  }

  if (type === 'head') {
    if (a === 'tuning') {
      const std = lang === 'de' ? 'E A D G H E' : 'E A D G B E';
      const o = options(`Normalstimmung (${std})`, ['Drop-D-Stimmung', 'Einen Halbton tiefer gestimmt', 'Die Akkorde des Songs'], rng);
      return {
        kind: 'choice',
        prompt: 'Was bedeutet diese Kopfzeile?',
        items: [key],
        figure: renderTextTab(['Tuning: E A D G B E'], 'Kopfzeile Tuning: E A D G B E'),
        ...o,
        explain: `<p>„Tuning: E A D G B E“ ist die <b>Normalstimmung</b>, von der tiefen zur hohen Saite${lang === 'de' ? ' – auf Deutsch E A D G H E' : ''}.</p>`,
        solution: `Tuning: E A D G B E = Normalstimmung`,
        hint: CHORDS_HINT,
      };
    }
    const o = options('Kapodaster in Bund 2, Griffe wie notiert', ['Alles 2 Bünde höher greifen', 'Den Song in der 2. Lage spielen', 'Die 2. Saite nicht spielen'], rng);
    return {
      kind: 'choice',
      prompt: 'Was bedeutet diese Kopfzeile?',
      items: [key],
      figure: renderTextTab(['Capo: 2nd fret'], 'Kopfzeile Capo: 2nd fret'),
      ...o,
      explain: `<p>„Capo: 2nd fret“ = <b>Kapodaster in den 2. Bund</b>, dann die Griffe spielen, wie sie dastehen.</p>
        <p class="muted">Ob das Feld „Key“ auf Ultimate Guitar die klingende Tonart meint und ob Tab-Zahlen ab dem Capo zählen, ist nicht einheitlich – im Zweifel mit der Aufnahme vergleichen.</p>`,
      solution: 'Capo: 2nd fret = Kapodaster in Bund 2',
      hint: CHORDS_HINT,
    };
  }

  // H/B-Fangfragen (nur Deutsch)
  const c = parseChord(a);
  const spoken = chordSpoken(c, 'de');
  const wrong: Record<(typeof HB)[number], string[]> = {
    Bm: ['b-Moll', 'H-Dur', 'B-Dur'],
    B7: ['B7', 'h-Moll', 'H-Dur'],
    Bb: ['H-Dur', 'b-Moll', 'h-Moll'],
    B: ['B-Dur', 'h-Moll', 'b-Moll'],
  };
  const o = options(spoken, wrong[a as (typeof HB)[number]], rng);
  const tones = chordTones(c).map((t) => noteName(t, 'de')).join(' ');
  return {
    kind: 'choice',
    prompt: `Auf Ultimate Guitar steht ${a}. Wie heißt der Akkord auf Deutsch?`,
    items: [key],
    ...o,
    explain: `<p class="hb-trap"><b>H/B-Falle:</b> Im Englischen heißt unser H „B“, unser B heißt „Bb“. ${esc(a)} ist also <b>${esc(spoken)}</b> (${esc(tones)}).</p>`,
    solution: `${a} = ${spoken}`,
    sound: [shapeMidi(parseShape(HB_SHAPES[a as (typeof HB)[number]]))],
    hint: `<p>Englisch B = deutsch H. Englisch Bb = deutsch B.</p>`,
  };
}

const RIFF_WITH_BARS: TabColumn[] = [
  { notes: [{ string: 5, text: '3' }] },
  { notes: [{ string: 4, text: '2' }] },
  { notes: [{ string: 3, text: '0' }] },
  { notes: [{ string: 2, text: '1' }] },
  { notes: [{ string: 5, text: '3' }, { string: 4, text: '2' }, { string: 3, text: '0' }, { string: 2, text: '1' }] },
];

const KNOW_Q: Record<Know, { prompt: string; correct: string; wrong: string[]; explain: string; short: string; figure: (lang: Lang) => string }> = {
  bar: {
    prompt: 'Was bedeuten die senkrechten Striche im Tab?',
    correct: 'Taktstriche',
    wrong: ['Bundstäbchen', 'Pausen', 'Saitenwechsel'],
    explain: 'Senkrechte Striche sind <b>Taktstriche</b> – nicht Bünde. Das steht sogar auf manchen deutschen Seiten falsch.',
    short: 'Senkrechte Striche',
    figure: (lang) => renderTab({ columns: RIFF_WITH_BARS, bars: [3], lang, label: 'Tab mit Taktstrich' }),
  },
  zero: {
    prompt: 'Was bedeutet die markierte 0?',
    correct: 'Leersaite anschlagen',
    wrong: ['Saite nicht spielen', 'Pause', 'Mit dem Zeigefinger greifen'],
    explain: '<b>0 = Leersaite</b>: die Saite anschlagen, ohne zu greifen. Nicht spielen wird mit x oder gar nicht notiert.',
    short: '0 im Tab',
    figure: (lang) =>
      renderTab({
        columns: RIFF_WITH_BARS.slice(0, 4).map((c, i) => ({ notes: c.notes.map((n) => ({ ...n, mark: i === 2 })) })),
        lang,
        label: 'Tab mit markierter 0',
      }),
  },
  stack: {
    prompt: 'Die Zahlen stehen übereinander. Was heißt das?',
    correct: 'Gleichzeitig spielen',
    wrong: ['Nacheinander von oben nach unten', 'Nacheinander von unten nach oben', 'Nur die oberste Zahl spielen'],
    explain: 'Zahlen <b>übereinander</b> werden <b>gleichzeitig</b> gespielt – zum Beispiel ein Akkord.',
    short: 'Übereinander',
    figure: (lang) =>
      renderTab({ columns: [RIFF_WITH_BARS[4]!].map((c) => ({ notes: c.notes.map((n) => ({ ...n, mark: true })) })), lang, label: 'Tab mit gestapelter Spalte' }),
  },
  top: {
    prompt: 'Welche Saite ist die oberste Linie im Tab?',
    correct: 'Die hohe e-Saite (1.)',
    wrong: ['Die tiefe E-Saite (6.)', 'Die A-Saite (5.)', 'Die G-Saite (3.)'],
    explain: 'Die <b>oberste Linie ist die hohe e-Saite</b> – also die dünnste. Beim Spielen ist sie die, die dem Boden am nächsten ist.',
    short: 'Oberste Linie',
    figure: (lang) => renderTab({ highlight: 1, lang, label: 'Tab, oberste Linie markiert' }),
  },
  fret: {
    prompt: 'Was gibt die Zahl im Tab an?',
    correct: 'Den Bund',
    wrong: ['Den Finger', 'Die Saite', 'Wie lange der Ton klingt'],
    explain: 'Die Zahl ist der <b>Bund</b>, nicht der Finger. Welche Saite, zeigt die Linie.',
    short: 'Zahl im Tab',
    figure: (lang) => renderTab({ columns: [{ notes: [{ string: 3, text: '5', mark: true }] }], names: true, lang, label: 'Tab mit einer 5 auf der G-Saite' }),
  },
};

export const tabsModule: ModuleDef = {
  id: 'tabs',
  name: 'Tabs lesen',
  desc: 'Tab-Linien, Zahlen, Spieltechniken, Bögen, Akkorde und Capo – wie auf Ultimate Guitar.',
  prefixes: ['tab:'],
  settings: [
    {
      id: 'topics',
      label: 'Themen',
      type: 'multi',
      options: [
        { value: 'basics', label: 'Grundlagen' },
        { value: 'tech', label: 'Spieltechniken' },
        { value: 'chords', label: 'Akkorde & Capo' },
      ],
      default: [...TOPICS],
    },
    COUNT_SETTING,
  ],
  count: (s) => Number(s.count ?? 20),
  keys: (s, lang) => tabKeys(s, lang),
  make(settings, ctx) {
    const key = ctx.forced ?? pickWeighted(tabKeys(settings, ctx.lang), ctx.stats, ctx.now, ctx.recent, ctx.rng);
    return build(key, ctx);
  },
  label(key, lang) {
    const [, type, a] = key.split(':') as [string, string, string];
    switch (type) {
      case 'line':
        return `Tab-Linie der ${a}. Saite`;
      case 'note':
        return `Ton im Tab auf der ${stringName(Number(a) as StringNo, lang)}`;
      case 'know':
        return KNOW_Q[a as Know]?.short ?? key;
      case 'tech':
        return `${TECHNIQUES[a as Tech]?.sign ?? a} (${TECHNIQUES[a as Tech]?.label ?? ''})`;
      case 'arc':
        return `Bogen: ${ARC_LABEL[a as Arc] ?? a}`;
      case 'stack':
        return `Tab-Spalte → ${chordById(a)?.symbol ?? a}`;
      case 'capo':
        return `Capo + ${a}-Griff → klingender Akkord`;
      case 'cfret':
        return `Capo-Bund für ${a}-Griffe`;
      case 'head':
        return a === 'tuning' ? 'Kopfzeile Tuning' : 'Kopfzeile Capo';
      case 'hb':
        return `H/B-Falle: ${a}`;
      default:
        return key;
    }
  },
};
