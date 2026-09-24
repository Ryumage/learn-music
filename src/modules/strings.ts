import { pickWeighted } from '../learn/picker';
import { OPEN_MIDI, STRINGS, stringLetter, stringName, stringNameDative, type StringNo } from '../music/guitar';
import { noteName, type Lang } from '../music/names';
import { type Note, type Spelling } from '../music/notes';
import { staffPositionText } from '../music/staff';
import { renderChordDiagram } from '../render/chordDiagram';
import { renderFretboard } from '../render/fretboard';
import { renderStaff } from '../render/staff';
import { renderTab } from '../render/tab';
import { esc } from '../util/html';
import { COUNT_SETTING, type MakeContext, type ModuleDef, type Question } from './types';

type Kind = 'name' | 'num' | 'all' | 'tab' | 'dia' | 'staff';
const KINDS: Kind[] = ['name', 'num', 'all', 'tab', 'dia', 'staff'];

/** Leersaiten notiert (Violinschlüssel mit 8). */
const OPEN_NOTATED: Record<StringNo, Note> = {
  6: { letter: 2, acc: 0, octave: 3 },
  5: { letter: 5, acc: 0, octave: 3 },
  4: { letter: 1, acc: 0, octave: 4 },
  3: { letter: 4, acc: 0, octave: 4 },
  2: { letter: 6, acc: 0, octave: 4 },
  1: { letter: 2, acc: 0, octave: 5 },
};

const spelling = (s: StringNo): Spelling => ({ letter: OPEN_NOTATED[s].letter, acc: 0 });

/** Eselsbrücken (PLAN M1). */
export const MNEMONICS: Record<Lang, Record<'up' | 'down', string[]>> = {
  de: {
    up: [
      'Ein Anfänger der Gitarre habe Eifer',
      'Eine alte dumme Gans hat Eier',
      'Eine alte Dame ging Hering essen',
      'Eine alte deutsche Gitarre hält ewig',
      'Eine alte Dame geht heute einkaufen',
    ],
    down: ['Ein hungriger Gitarrist darf alles essen', 'Emil half gestern dem alten Esel'],
  },
  en: {
    up: ['Eddie ate dynamite, good bye Eddie', 'Even after dinner giant boys eat'],
    down: ['Every boy gets dinner at eight'],
  },
};

/** Anfangsbuchstaben hervorheben. */
export function mnemonicHtml(text: string): string {
  return text
    .split(' ')
    .map((w) => `<b>${esc(w.charAt(0))}</b>${esc(w.slice(1))}`)
    .join(' ');
}

function mnemonic(lang: Lang, dir: 'up' | 'down', rng: () => number): string {
  const list = MNEMONICS[lang][dir];
  const text = list[Math.floor(rng() * list.length)]!;
  const order = dir === 'up' ? 'tief → hoch' : 'hoch → tief';
  return `<p class="mnemonic"><span class="mnemonic-label">Eselsbrücke (${order})</span> ${mnemonicHtml(text)}</p>`;
}

const ruleNumbers = 'Die dünnste Saite ist Nr. 1, die dickste Nr. 6.';

function stringsWithName(given: Spelling, lang: Lang): string {
  const hits = STRINGS.filter((s) => spelling(s).letter === given.letter && given.acc === 0).sort((a, b) => a - b);
  if (hits.length === 0) return `Das war ${noteName(given, lang)} – keine Leersaite heißt so.`;
  const nums = hits.map((s) => `${s}.`).join(' oder ');
  return `Das war ${noteName(given, lang)} – das ist die ${nums} Saite.`;
}

function allKeys(kinds: string[]): string[] {
  const keys: string[] = [];
  for (const k of kinds as Kind[]) {
    if (k === 'all') keys.push('str:all:up', 'str:all:down');
    else for (const s of STRINGS) keys.push(`str:${k}:${s}`);
  }
  return keys;
}

function build(key: string, ctx: MakeContext): Question {
  const { lang } = ctx;
  const [, kind, arg] = key.split(':') as [string, Kind, string];
  const up = arg !== 'down';

  if (kind === 'all') {
    const order: StringNo[] = up ? [6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6];
    const names = order.map((s) => stringLetter(s, lang)).join(' ');
    return {
      kind: 'notes',
      prompt: up ? 'Nenne alle Saiten von tief nach hoch.' : 'Nenne alle Saiten von hoch nach tief.',
      items: [key],
      fields: order.map((s) => ({ label: `${s}.`, answer: spelling(s) })),
      compare: 'pc',
      accidentals: false,
      explain: `<p>${up ? 'Von tief nach hoch' : 'Von hoch nach tief'}: <b>${esc(names)}</b>.</p>
        <p>${ruleNumbers} In deutscher Oktavschreibweise heißen die Leersaiten <b>E A d g h e'</b>.</p>`,
      solution: names,
      after: mnemonic(lang, up ? 'up' : 'down', ctx.rng),
    };
  }

  const s = Number(arg) as StringNo;
  const name = stringName(s, lang);
  const letter = stringLetter(s, lang);
  const after = mnemonic(lang, 'up', ctx.rng);

  switch (kind) {
    case 'name':
      return {
        kind: 'notes',
        prompt: `Wie heißt die ${s}. Saite?`,
        items: [key],
        figure: renderFretboard({ from: 0, to: 3, view: ctx.fretView, labels: 'numbers', highlight: s, lang, label: `Griffbrett, ${s}. Saite markiert` }),
        fields: [{ answer: spelling(s) }],
        compare: 'pc',
        accidentals: false,
        describe: (given) => stringsWithName(given, lang),
        explain: `<p>Die ${s}. Saite ist die <b>${esc(name)}</b>.</p><p>${ruleNumbers}</p>`,
        solution: `${s}. Saite = ${letter}`,
        after,
      };
    case 'num':
      return {
        kind: 'choice',
        prompt: `Welche Nummer hat die ${name}?`,
        items: [key],
        figure: renderFretboard({ from: 0, to: 3, view: ctx.fretView, labels: 'names', highlight: s, lang, label: `Griffbrett mit Saitennamen, ${name} markiert` }),
        options: [1, 2, 3, 4, 5, 6].map((n) => `${n}. Saite`),
        correct: s - 1,
        describe: (g) => `Das war die ${g + 1}. Saite (${stringName((g + 1) as StringNo, lang)}).`,
        explain: `<p>Die ${esc(name)} ist die <b>${s}. Saite</b>.</p><p>${ruleNumbers}</p>`,
        solution: `${name} = ${s}. Saite`,
        after,
      };
    case 'tab':
      return {
        kind: 'notes',
        prompt: 'Welche Saite ist die markierte Tab-Linie?',
        items: [key],
        figure: renderTab({ highlight: s, lang, label: `Tab, Linie der ${s}. Saite markiert` }),
        fields: [{ answer: spelling(s) }],
        compare: 'pc',
        accidentals: false,
        describe: (given) => stringsWithName(given, lang),
        explain: `<p>Die markierte Linie ist die <b>${s}. Saite (${esc(name)})</b>.</p>
          <p>Im <b>Tab ist oben die hohe E-Saite</b> – beim Spielen die Saite, die dem Boden am nächsten ist.</p>`,
        solution: `Tab-Linie ${7 - s} von oben = ${s}. Saite (${letter})`,
        after,
      };
    case 'dia':
      return {
        kind: 'notes',
        prompt: 'Welche Saite ist im Akkorddiagramm markiert?',
        items: [key],
        figure: renderChordDiagram({ highlight: s, label: `Akkorddiagramm, ${7 - s}. Linie von links markiert` }),
        fields: [{ answer: spelling(s) }],
        compare: 'pc',
        accidentals: false,
        describe: (given) => stringsWithName(given, lang),
        explain: `<p>Markiert ist die <b>${s}. Saite (${esc(name)})</b>.</p>
          <p>Im <b>Akkorddiagramm ist links die tiefe E-Saite</b>, rechts die hohe E-Saite.</p>`,
        solution: `Diagramm-Linie ${7 - s} von links = ${s}. Saite (${letter})`,
        after,
      };
    case 'staff': {
      const note = OPEN_NOTATED[s];
      const pos = staffPositionText(note);
      const nn = noteName(note, lang);
      return {
        kind: 'choice',
        prompt: 'Diese Note ist eine Leersaite. Welche?',
        items: [key],
        figure: renderStaff({ columns: [[note]], label: `Notensystem mit einer Note: ${pos}` }),
        options: [1, 2, 3, 4, 5, 6].map((n) => `${n}. Saite (${stringName(n as StringNo, lang)})`),
        correct: s - 1,
        describe: (g) => {
          const other = OPEN_NOTATED[(g + 1) as StringNo];
          return `Die ${g + 1}. Saite stünde ${staffPositionText(other)}.`;
        },
        explain: `<p><b>${esc(nn)}</b> · ${esc(pos)} · <b>${s}. Saite (${esc(name)})</b>.</p>
          <p>Gitarre klingt eine Oktave tiefer als notiert – deshalb die kleine 8 unter dem Violinschlüssel.</p>`,
        solution: `${nn} · ${pos} = ${s}. Saite`,
        after,
      };
    }
  }
}

const HINT = `<p>Tief → hoch: <b>E A D G H E</b>. Die dünnste Saite ist Nr. 1 (hohe E-Saite), die dickste Nr. 6 (tiefe E-Saite).</p>
  <p>Im Tab ist oben die hohe E-Saite. Im Akkorddiagramm ist links die tiefe E-Saite.</p>`;

export const stringsModule: ModuleDef = {
  id: 'strings',
  name: 'Saiten & Eselsbrücken',
  desc: 'Namen, Nummern und Lage der Leersaiten – im Griffbrett, Tab, Diagramm und Notensystem.',
  prefixes: ['str:'],
  settings: [
    COUNT_SETTING,
    {
      id: 'kinds',
      label: 'Aufgaben',
      type: 'multi',
      options: [
        { value: 'name', label: 'Saite benennen' },
        { value: 'num', label: 'Nummer' },
        { value: 'all', label: 'Alle Saiten' },
        { value: 'tab', label: 'Tab' },
        { value: 'dia', label: 'Diagramm' },
        { value: 'staff', label: 'Notensystem' },
      ],
      default: [...KINDS],
    },
  ],
  count: (s) => Number(s.count ?? 20),
  keys: (s) => allKeys((s.kinds as string[] | undefined)?.length ? (s.kinds as string[]) : KINDS),
  make(settings, ctx) {
    const keys = this.keys(settings);
    const key = ctx.forced ?? pickWeighted(keys, ctx.stats, ctx.now, ctx.recent, ctx.rng);
    const q = build(key, ctx);
    const [, kind, arg] = key.split(':');
    const sound =
      kind === 'all'
        ? (arg === 'down' ? [1, 2, 3, 4, 5, 6] : [6, 5, 4, 3, 2, 1]).map((s) => [OPEN_MIDI[s as StringNo]])
        : [[OPEN_MIDI[Number(arg) as StringNo]]];
    return { ...q, hint: HINT, sound };
  },
  label(key, lang) {
    const [, kind, arg] = key.split(':') as [string, Kind, string];
    if (kind === 'all') return arg === 'down' ? 'Alle Saiten hoch → tief' : 'Alle Saiten tief → hoch';
    const s = Number(arg) as StringNo;
    return {
      name: `${s}. Saite benennen`,
      num: `Nummer der ${stringNameDative(s, lang)}`,
      tab: `Tab-Linie der ${s}. Saite`,
      dia: `Diagramm: ${s}. Saite`,
      staff: `Leersaite im System: ${noteName(OPEN_NOTATED[s], lang)}`,
    }[kind];
  },
};
