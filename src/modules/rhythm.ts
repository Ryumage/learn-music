import { pickWeighted } from '../learn/picker';
import type { ModuleSettings } from '../learn/store';
import {
  BEAT_OPTIONS,
  BEATS,
  barSeconds,
  beatSeconds,
  beatsText,
  COUNT_LABELS,
  countAlong,
  countLabel,
  countMeasureWith,
  fillMeasure,
  onsets,
  secondsText,
  STRUM_PATTERNS,
  strumDirection,
  TEMPOS,
  TIME_SIGNATURES,
  VALUE_LOOK,
  VALUE_NAMES,
  VALUES,
  type NoteValue,
  type TimeSig,
} from '../music/rhythm';
import { renderTab, type TabColumn } from '../render/tab';
import { esc } from '../util/html';
import { COUNT_SETTING, type MakeContext, type ModuleDef, type Question } from './types';

type Topic = 'values' | 'count' | 'time';
const TOPICS: Topic[] = ['values', 'count', 'time'];

/** „Takt ergänzen“: die Ganze kann nicht fehlen, sie füllt den Takt allein. */
const FILL_VALUES = VALUES.filter((v) => v !== 'whole');

export function rhythmKeys(s: ModuleSettings): string[] {
  const t = (s.topics as Topic[] | undefined)?.length ? (s.topics as Topic[]) : TOPICS;
  const keys: string[] = [];
  if (t.includes('values')) {
    keys.push(...VALUES.map((v) => `rh:val:${v}`), ...VALUES.map((v) => `rh:beats:${v}`), ...FILL_VALUES.map((v) => `rh:fill:${v}`));
  }
  if (t.includes('count')) keys.push(...COUNT_LABELS.map((_, i) => `rh:count:${i}`), ...COUNT_LABELS.map((_, i) => `rh:strum:${i}`));
  if (t.includes('time')) {
    keys.push(...Object.keys(TIME_SIGNATURES).map((ts) => `rh:time:${ts}`));
    for (const bpm of TEMPOS) keys.push(`rh:tempo:${bpm}:beat`, `rh:tempo:${bpm}:bar`);
  }
  return keys;
}

/** Bund-Zahlen für die Tab-Spalten: ein ruhiges Riff auf G- und D-Saite */
function riffColumns(values: readonly NoteValue[], rng: () => number, mark = -1, missing = -1): TabColumn[] {
  return values.map((v, i) => ({
    notes: [{ string: rng() < 0.5 ? 3 : 4, text: i === missing ? '?' : String(Math.floor(rng() * 4)), mark: i === mark || i === missing }],
    rhythm: v,
    hideRhythm: i === missing,
  }));
}

const valueNames = VALUES.map((v) => VALUE_NAMES[v]);

function countRow(values: readonly NoteValue[]): string {
  return `<p class="count-along">Gezählt: ${countAlong(values)
    .map((c) => (c.hit ? `<b>${esc(c.label)}</b>` : esc(c.label)))
    .join(' ')}</p>`;
}

function strumFigure(pattern: string, mark: number, showCounts: boolean): string {
  return `<div class="strum" role="img" aria-label="Schlagmuster ${esc(pattern)}, Schlag ${mark + 1} markiert">${[...pattern]
    .map((ch, i) => {
      const arrow = ch === 'D' ? '↓' : ch === 'U' ? '↑' : '';
      const count = showCounts ? `<span class="strum-count">${esc(COUNT_LABELS[i]!)}</span>` : '';
      return `<span class="strum-slot${i === mark ? ' is-mark' : ''}">${arrow || '&nbsp;'}${count}</span>`;
    })
    .join('')}</div>`;
}

const VALUES_HINT = `<p>Unter dem Tab: <b>eingekreiste Zahl</b> = Ganze (ohne Hals) oder Halbe (kurzer Hals). <b>Langer Hals</b> = Viertel, ein Fähnchen oder Balken = Achtel, zwei = Sechzehntel. Ein Punkt verlängert um die Hälfte.</p>
  <p>Ganze 4 · Halbe 2 · Viertel 1 · Achtel ½ · Sechzehntel ¼ Schläge.</p>`;
const COUNT_HINT = `<p>Achtel zählt man „1 + 2 + 3 + 4 +“. Beim Schlagmuster: <b>↓ auf den Zahlen, ↑ auf „und“</b>.</p>`;
const TIME_HINT = `<p>♩ = 60 heißt 60 Schläge pro Minute: ein Schlag dauert 60 ÷ Tempo Sekunden, ein 4/4-Takt 240 ÷ Tempo.</p>`;

function build(key: string, ctx: MakeContext): Question {
  const { rng } = ctx;
  const [, type, a, b] = key.split(':') as [string, string, string, string | undefined];

  if (type === 'val' || type === 'beats') {
    const v = a as NoteValue;
    const figure = renderTab({ columns: [{ notes: [{ string: 3, text: String(2 + Math.floor(rng() * 3)) }], rhythm: v }], lang: ctx.lang, label: `Tab mit einer Note: ${VALUE_LOOK[v]}` });
    if (type === 'val') {
      return {
        kind: 'choice',
        prompt: 'Welcher Notenwert steht unter dem Tab?',
        items: [key],
        figure,
        options: valueNames,
        correct: VALUES.indexOf(v),
        describe: (g) => `${VALUE_NAMES[VALUES[g]!]} sähe so aus: ${VALUE_LOOK[VALUES[g]!]}.`,
        explain: `<p><b>${esc(VALUE_NAMES[v])}</b>: ${esc(VALUE_LOOK[v])} – ${esc(beatsText(BEATS[v]))} ${BEATS[v] > 1 ? 'Schläge' : 'Schlag'}.</p>`,
        solution: `${VALUE_LOOK[v]} = ${VALUE_NAMES[v]}`,
        hint: VALUES_HINT,
      };
    }
    const opts = BEAT_OPTIONS.map(beatsText);
    return {
      kind: 'choice',
      prompt: 'Wie viele Schläge dauert dieser Wert? (Viertel = 1 Schlag)',
      items: [key],
      figure,
      options: opts,
      correct: (BEAT_OPTIONS as readonly number[]).indexOf(BEATS[v]),
      explain: `<p>Das ist eine <b>${esc(VALUE_NAMES[v])}</b> (${esc(VALUE_LOOK[v])}): <b>${esc(beatsText(BEATS[v]))}</b> ${BEATS[v] > 1 ? 'Schläge' : 'Schlag'}.</p>`,
      solution: `${VALUE_NAMES[v]} = ${beatsText(BEATS[v])} ${BEATS[v] > 1 ? 'Schläge' : 'Schlag'}`,
      hint: VALUES_HINT,
    };
  }

  if (type === 'fill') {
    const v = a as NoteValue;
    const { values, index } = fillMeasure(v, rng);
    const present = values.filter((_, i) => i !== index);
    const sum = present.reduce((s, x) => s + BEATS[x], 0);
    return {
      kind: 'choice',
      prompt: 'Im 4/4-Takt fehlt ein Wert. Welcher gehört an die Stelle „?“',
      items: [key],
      figure: renderTab({ columns: riffColumns(values, rng, -1, index), lang: ctx.lang, label: `4/4-Takt mit ${values.length} Noten, eine fehlt` }),
      options: valueNames,
      correct: VALUES.indexOf(v),
      describe: (g) => `Mit ${VALUE_NAMES[VALUES[g]!]} hätte der Takt ${beatsText(sum + BEATS[VALUES[g]!])} statt 4 Schläge.`,
      explain: `<p>Vorhanden: ${present.map((x) => esc(beatsText(BEATS[x]))).join(' + ')} = <b>${esc(beatsText(sum))}</b> Schläge.</p>
        <p>Bis 4 fehlen <b>${esc(beatsText(4 - sum))}</b> – das ist eine <b>${esc(VALUE_NAMES[v])}</b>.</p>`,
      solution: `fehlend ${beatsText(4 - sum)} Schläge = ${VALUE_NAMES[v]}`,
      hint: VALUES_HINT,
    };
  }

  if (type === 'count') {
    const slot = Number(a);
    const { values, index } = countMeasureWith(slot / 2, rng);
    const label = countLabel(onsets(values)[index]!);
    return {
      kind: 'choice',
      prompt: 'Auf welcher Zählzeit kommt die markierte Note?',
      items: [key],
      figure: renderTab({ columns: riffColumns(values, rng, index), lang: ctx.lang, label: `4/4-Takt, Note ${index + 1} markiert` }),
      options: [...COUNT_LABELS],
      correct: slot,
      explain: `${countRow(values)}<p>Die markierte Note kommt auf <b>„${esc(label)}“</b>.</p>`,
      solution: `Note ${index + 1} im Takt = „${label}“`,
      hint: COUNT_HINT,
    };
  }

  if (type === 'strum') {
    const slot = Number(a);
    const fitting = STRUM_PATTERNS.filter((p) => p.pattern[slot] !== '.');
    const pat = fitting[Math.floor(rng() * fitting.length)]!;
    const dir = strumDirection(slot);
    return {
      kind: 'choice',
      prompt: 'Auf welcher Zählzeit kommt der markierte Schlag?',
      items: [key],
      figure: strumFigure(pat.pattern, slot, false),
      options: [...COUNT_LABELS],
      correct: slot,
      describe: (g) => `Auf „${COUNT_LABELS[g]}“ käme ein ${strumDirection(g) === 'D' ? 'Abschlag ↓' : 'Aufschlag ↑'}.`,
      explain: `${strumFigure(pat.pattern, slot, true)}
        <p>${pat.name ? `„${esc(pat.name)}“: ` : ''}Der markierte Schlag ist ein ${dir === 'D' ? '<b>Abschlag ↓</b> – also auf einer Zahl' : '<b>Aufschlag ↑</b> – also auf „und“'}: <b>„${esc(COUNT_LABELS[slot]!)}“</b>.</p>
        <p>Leere Felder sind Luftschläge: die Hand bewegt sich weiter, trifft die Saiten aber nicht.</p>`,
      solution: `Schlag ${slot + 1} von 8 = „${COUNT_LABELS[slot]}“`,
      hint: COUNT_HINT,
    };
  }

  if (type === 'time') {
    const ts = a as TimeSig;
    const [top, bottom] = ts.split('/');
    const opts = [...Object.values(TIME_SIGNATURES), '2 Halbe pro Takt'];
    return {
      kind: 'choice',
      prompt: `Was bedeutet die Taktart ${ts}?`,
      items: [key],
      figure: `<div class="timesig" role="img" aria-label="Taktart ${esc(ts)}"><span>${esc(top!)}</span><span>${esc(bottom!)}</span></div>`,
      options: opts,
      correct: opts.indexOf(TIME_SIGNATURES[ts]),
      explain: `<p><b>${esc(ts)}</b> = ${esc(TIME_SIGNATURES[ts])}.${ts === '6/8' ? ' Gezählt „1-und-a-2-und-a“ – zwei Schwerpunkte mit je drei Achteln.' : ' Die obere Zahl sagt wie viele, die untere welche Notenwerte.'}</p>`,
      solution: `${ts} = ${TIME_SIGNATURES[ts]}`,
      hint: `<p>Obere Zahl = wie viele, untere Zahl = welcher Wert (4 = Viertel, 8 = Achtel).</p>`,
    };
  }

  // Tempo
  const bpm = Number(a);
  const bar = b === 'bar';
  const f = bar ? barSeconds : beatSeconds;
  const opts = TEMPOS.map((t) => secondsText(f(t)));
  const answer = secondsText(f(bpm));
  return {
    kind: 'choice',
    prompt: bar ? `♩ = ${bpm}: Wie lange dauert ein 4/4-Takt?` : `♩ = ${bpm}: Wie lange dauert ein Schlag?`,
    items: [key],
    options: opts,
    correct: opts.indexOf(answer),
    explain: bar
      ? `<p>4 Schläge × 60 s ÷ ${bpm} = 240 ÷ ${bpm} = <b>${esc(answer)}</b>.</p>`
      : `<p>60 s ÷ ${bpm} Schläge = <b>${esc(answer)}</b> pro Schlag.</p>`,
    solution: `♩ = ${bpm}: ${bar ? 'Takt' : 'Schlag'} = ${answer}`,
    hint: TIME_HINT,
  };
}

export const rhythmModule: ModuleDef = {
  id: 'rhythm',
  name: 'Rhythmus',
  desc: 'Notenwerte unter dem Tab, zählen, Schlagmuster, Taktart und Tempo.',
  prefixes: ['rh:'],
  settings: [
    {
      id: 'topics',
      label: 'Themen',
      type: 'multi',
      options: [
        { value: 'values', label: 'Notenwerte' },
        { value: 'count', label: 'Zählen & Schlagmuster' },
        { value: 'time', label: 'Taktart & Tempo' },
      ],
      default: [...TOPICS],
    },
    COUNT_SETTING,
  ],
  count: (s) => Number(s.count ?? 20),
  keys: (s) => rhythmKeys(s),
  make(settings, ctx) {
    const key = ctx.forced ?? pickWeighted(rhythmKeys(settings), ctx.stats, ctx.now, ctx.recent, ctx.rng);
    return build(key, ctx);
  },
  label(key) {
    const [, type, a, b] = key.split(':') as [string, string, string, string | undefined];
    switch (type) {
      case 'val':
        return `Notenwert erkennen: ${VALUE_NAMES[a as NoteValue]}`;
      case 'beats':
        return `Schläge: ${VALUE_NAMES[a as NoteValue]}`;
      case 'fill':
        return `Takt ergänzen: ${VALUE_NAMES[a as NoteValue]}`;
      case 'count':
        return `Zählzeit „${COUNT_LABELS[Number(a)]}“`;
      case 'strum':
        return `Schlagmuster: „${COUNT_LABELS[Number(a)]}“`;
      case 'time':
        return `Taktart ${a}`;
      case 'tempo':
        return `Tempo ${a}: ${b === 'bar' ? 'Takt' : 'Schlag'}`;
      default:
        return key;
    }
  },
};
