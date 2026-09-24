import { pickWeighted } from '../learn/picker';
import type { ModuleSettings } from '../learn/store';
import {
  checkShape,
  chordPitchClasses,
  chordSpoken,
  chordSymbol,
  chordTones,
  CHORDS,
  formulaText,
  parseChord,
  parseShape,
  shapeMidi,
  shapeString,
  type ChordDef,
  type ChordSymbol,
  type Shape,
} from '../music/chords';
import { OPEN_MIDI } from '../music/guitar';
import { noteName, pitchClassLabel, type Lang } from '../music/names';
import { fromMidi, mod, pitchClass, type Spelling } from '../music/notes';
import { renderChordShape } from '../render/chordDiagram';
import { esc } from '../util/html';
import { COUNT_SETTING, type MakeContext, type ModuleDef, type Question } from './types';

type Task = 'name' | 'shape' | 'tones';
const TASKS: Task[] = ['name', 'shape', 'tones'];
const PREFIX: Record<Task, string> = { name: 'chn:', shape: 'chs:', tones: 'cht:' };

/** Lernreihenfolge (JustinGuitar): A, D → E → Am, Em → Dm → C, G → F/Fmaj7 → sus/7. */
export const LEARN_ORDER = ['A', 'D', 'E', 'Am', 'Em', 'Dm', 'C', 'G', 'Fs', 'Fmaj7'];

export const chordById = (id: string) => CHORDS.find((c) => c.id === id);

function cfg(s: ModuleSettings): { tasks: Task[]; chords: ChordDef[] } {
  const sets = (s.sets as string[] | undefined)?.length ? (s.sets as string[]) : ['basic'];
  const task = (s.task as string) ?? 'mixed';
  return { tasks: task === 'mixed' ? TASKS : [task as Task], chords: CHORDS.filter((c) => sets.includes(c.set)) };
}

/** Deutsche Aussprache nur im Deutsch-Modus; Symbole bleiben international. */
export function chordTitle(c: ChordSymbol, symbol: string, lang: Lang): string {
  const spoken = chordSpoken(c, 'de');
  return lang === 'de' && spoken !== symbol ? `${symbol} (${spoken})` : symbol;
}

/** Erklärung: Formel in Worten, Töne, Aussprache, H/B-Falle. */
export function chordExplain(def: ChordDef, lang: Lang): string {
  const c = parseChord(def.symbol);
  const tones = chordTones(c).map((t) => noteName(t, lang)).join(' ');
  const spoken = chordSpoken(c, 'de');
  const hb =
    lang === 'de' && c.root.letter === 6 && c.root.acc === 0
      ? `<p class="hb-trap"><b>H/B-Falle:</b> Auf Ultimate Guitar steht ${esc(def.symbol)}, auf Deutsch sagt man ${esc(spoken)}.</p>`
      : '';
  const seventhNote = def.id === 'C7' ? '<p>Im Griff fehlt die Quinte (G) – bei Septakkorden ist das erlaubt.</p>' : '';
  return `<p><b>${esc(chordTitle(c, def.symbol, lang))}</b>: ${esc(formulaText(c.suffix))}.</p>
    <p>Töne: <b>${esc(tones)}</b></p>${seventhNote}${hb}`;
}

/** Tonname einer Saite: in Akkordschreibweise, wenn der Ton zum Akkord gehört. */
function stringToneName(midi: number, c: ChordSymbol, lang: Lang): string {
  const pc = mod(midi, 12);
  const tone = chordTones(c).find((t) => pitchClass(t) === pc);
  if (tone) return noteName(tone, lang);
  const sharp = fromMidi(midi, 'sharp');
  return sharp.acc === 0 ? noteName(sharp, lang) : pitchClassLabel(pc, lang).split('/')[0]!;
}

export function shapeNames(shape: Shape, c: ChordSymbol, lang: Lang): (string | null)[] {
  return shape.map((f, i) => (f === null ? null : stringToneName(OPEN_MIDI[shapeString(i)] + f, c, lang)));
}

/** Griff-Prüfung: Akkordtöne vollständig (Septakkord: Quinte darf fehlen), keine fremden, genug Saiten. */
export function shapeOk(shape: Shape, c: ChordSymbol): boolean {
  const played = shape.filter((f) => f !== null).length;
  return checkShape(shape, c).ok && played >= (c.suffix === '5' ? 2 : 3);
}

function spell(pc: number, c: ChordSymbol, lang: Lang): string {
  const tone = chordTones(c).find((t) => pitchClass(t) === pc);
  return tone ? noteName(tone, lang) : pitchClassLabel(pc, lang);
}

function build(key: string, ctx: MakeContext): Question {
  const { lang } = ctx;
  const [prefix, id] = [key.slice(0, 4), key.slice(4)];
  const def = chordById(id)!;
  const c = parseChord(def.symbol);
  const shape = parseShape(def.shape);
  const title = chordTitle(c, def.symbol, lang);
  const sound = [shapeMidi(shape)];
  const explain = chordExplain(def, lang);
  const diagram = (label: string) => renderChordShape({ shape, fingers: def.fingers, label });

  if (prefix === 'chn:') {
    return {
      kind: 'chord',
      prompt: 'Welcher Akkord ist das?',
      items: [key],
      figure: diagram(`Akkorddiagramm ${def.label}`),
      answer: { root: c.root, suffix: c.suffix },
      describe: (g) => {
        if (!g.root) return '';
        const given = { root: g.root, suffix: (g.suffix ?? '') as ChordSymbol['suffix'] };
        const tones = chordTones(given).map((t) => noteName(t, lang)).join(' ');
        return `Das wäre ${chordTitle(given, chordSymbol(given), lang)} mit den Tönen ${tones}.`;
      },
      explain,
      solution: `${def.label} = ${title}`,
      sound,
    };
  }

  if (prefix === 'chs:') {
    const wanted = chordPitchClasses(c);
    return {
      kind: 'shape',
      prompt: `Setze den Griff für ${title}.`,
      items: [key],
      grade: (s) => shapeOk(s, c),
      names: (s) => shapeNames(s, c, lang),
      solutionShape: shape,
      solutionFingers: def.fingers,
      describe: (s) => {
        const played = s.filter((f) => f !== null).length;
        const r = checkShape(s, c);
        const parts: string[] = [];
        if (r.missing.length) parts.push(`Es fehlt: ${r.missing.map((pc) => spell(pc, c, lang)).join(', ')}.`);
        if (r.foreign.length) parts.push(`Gehört nicht dazu: ${r.foreign.map((pc) => spell(pc, c, lang)).join(', ')}.`);
        if (played < (c.suffix === '5' ? 2 : 3)) parts.push('Spiele mindestens drei Saiten.');
        return parts.join(' ') || `Gebraucht werden ${wanted.map((pc) => spell(pc, c, lang)).join(', ')}.`;
      },
      noteOk: (s) => {
        const bass = shapeMidi(s)[0];
        if (bass === undefined || mod(bass, 12) === pitchClass(c.root)) return '';
        return `Richtig – mit ${spell(mod(bass, 12), c, lang)} im Bass ist es eine Umkehrung.`;
      },
      explain: `${explain}<p>Standardgriff:</p>${diagram(`Standardgriff ${def.label}`)}`,
      solution: `${def.label}: ${def.shape}`,
      sound,
    };
  }

  const tones = chordTones(c);
  return {
    kind: 'notes',
    prompt: `Welche Töne hat ${title}?`,
    items: [key],
    fields: tones.map((t: Spelling) => ({ answer: t })),
    compare: 'pc',
    unordered: true,
    accidentals: true,
    explain,
    solution: `${def.symbol}: ${tones.map((t) => noteName(t, lang)).join(' ')}`,
    sound,
  };
}

const HINT = `<p><b>Dur</b>: Grundton, große Terz (4 Halbtöne), Quinte (7).<br><b>Moll</b>: Grundton, kleine Terz (3), Quinte (7).<br>
  <b>7</b>: plus kleine Septime (10) · <b>maj7</b>: plus große Septime (11).</p>
  <p>Im Diagramm ist links die tiefe E-Saite. × = nicht spielen, ○ = leer.</p>`;

export const chordsModule: ModuleDef = {
  id: 'chords',
  name: 'Akkorde',
  desc: 'Akkorddiagramme lesen, Griffe setzen und Akkordtöne nennen. Symbole wie auf Ultimate Guitar.',
  prefixes: Object.values(PREFIX),
  settings: [
    {
      id: 'sets',
      label: 'Akkorde',
      type: 'multi',
      options: [
        { value: 'basic', label: '8 Grundakkorde' },
        { value: 'plus', label: 'F, Fmaj7, sus, add9, m7, maj7' },
        { value: 'seven', label: 'Septakkorde' },
        { value: 'barre', label: 'Barré & Powerchords' },
      ],
      default: ['basic'],
    },
    {
      id: 'task',
      label: 'Aufgabe',
      type: 'choice',
      options: [
        { value: 'name', label: 'Diagramm → Name' },
        { value: 'shape', label: 'Griff setzen' },
        { value: 'tones', label: 'Akkordtöne' },
        { value: 'mixed', label: 'Gemischt' },
      ],
      default: 'mixed',
    },
    COUNT_SETTING,
  ],
  count: (s) => Number(s.count ?? 20),
  keys(s) {
    const c = cfg(s);
    return c.tasks.flatMap((t) => c.chords.map((ch) => PREFIX[t] + ch.id));
  },
  make(settings, ctx) {
    const key = ctx.forced ?? pickWeighted(this.keys(settings), ctx.stats, ctx.now, ctx.recent, ctx.rng);
    return { ...build(key, ctx), hint: HINT };
  },
  label(key, lang) {
    const def = chordById(key.slice(4));
    if (!def) return key;
    const t = chordTitle(parseChord(def.symbol), def.label, lang);
    return key.startsWith('chn:') ? `Diagramm → ${t}` : key.startsWith('chs:') ? `Griff: ${t}` : `Töne: ${t}`;
  },
};

