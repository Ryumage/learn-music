import { pickWeighted } from '../learn/picker';
import { fretMidi, positionsOf, positionText, type Position } from '../music/guitar';
import { noteName, pitchClassLabel } from '../music/names';
import { mod, noteKey, parseNote, soundingMidi } from '../music/notes';
import { staffPositionText } from '../music/staff';
import { fretWindow } from '../render/fretboard';
import { renderStaff } from '../render/staff';
import { esc } from '../util/html';
import { OCTAVE_HINT } from './fretboard';
import { level, LEVELS } from './staffReading';
import { COUNT_SETTING, type ModuleDef } from './types';

const key = (k: string) => `read:${k}`;
const noteOf = (k: string) => parseNote(k.slice('read:'.length));

export const OCTAVE_MESSAGE = 'Richtiger Ton, falsche Oktave – Gitarre klingt eine Oktave tiefer als notiert.';

export const readModule: ModuleDef = {
  id: 'read',
  name: 'Noten → Griffbrett',
  desc: 'Eine Note im System lesen und die Stelle auf dem Griffbrett antippen.',
  prefixes: ['read:'],
  settings: [
    {
      id: 'level',
      label: 'Stufe',
      type: 'choice',
      options: LEVELS.map((l) => ({ value: String(l.id), label: `${l.id} · ${l.label}`, labelEn: l.labelEn ? `${l.id} · ${l.labelEn}` : undefined })),
      default: '1',
    },
    COUNT_SETTING,
  ],
  count: (s) => Number(s.count ?? 20),
  keys: (s) => level(s).notes.map((n) => key(noteKey(n))),
  make(settings, ctx) {
    const lv = level(settings);
    const k = ctx.forced ?? pickWeighted(this.keys(settings), ctx.stats, ctx.now, ctx.recent, ctx.rng);
    const note = noteOf(k);
    const sounding = soundingMidi(note);
    const all = positionsOf(sounding, 12);
    // 1. Lage: Bund 0–5, sonst ein 8-Bund-Fenster um eine gültige Stelle
    const anchor = all[Math.floor(ctx.rng() * all.length)] ?? { string: 1, fret: 0 };
    const window: [number, number] = lv.maxFret <= 4 ? [0, 5] : fretWindow([0, 12], anchor.fret, ctx.rng);
    const inside = (p: Position) => p.fret >= window[0] && p.fret <= window[1];
    const targets = all.filter(inside);
    const others = all.filter((p) => !inside(p));
    const { lang } = ctx;
    const nn = noteName(note, lang);
    const where = targets.map((t) => positionText(t, lang)).join(' · ');
    const outside = others.length ? `Außerdem: ${others.map((t) => positionText(t, lang)).join(' · ')}` : undefined;
    return {
      kind: 'tap',
      prompt: 'Wo spielst du diese Note? Tippe die Stelle an.',
      items: [k],
      figure: renderStaff({ columns: [[note]], label: `Notensystem: ${nn}, ${staffPositionText(note)}` }),
      board: { from: window[0], to: window[1], strings: [6, 5, 4, 3, 2, 1], labels: 'names', label: 'Griffbrett zum Antippen' },
      multi: false,
      targets,
      outside,
      describe: (sel) => {
        const p = sel[0];
        if (!p) return '';
        const m = fretMidi(p.string, p.fret);
        if (m !== sounding && mod(m - sounding, 12) === 0) return OCTAVE_MESSAGE;
        return `Das war ${pitchClassLabel(m, lang)} (${positionText(p, lang)}).`;
      },
      explain: `<p><b>${esc(nn)}</b> · ${esc(staffPositionText(note))} · ${esc(where)}</p>
        ${outside ? `<p>${esc(outside)}</p>` : ''}
        <p>Gitarre klingt eine Oktave tiefer als notiert. Richtig ist jede Stelle mit genau dieser Tonhöhe.</p>`,
      solution: `${nn} · ${staffPositionText(note)} = ${where}`,
      sound: [[sounding]],
      hint: OCTAVE_HINT,
    };
  },
  label(k, lang) {
    const n = noteOf(k);
    return `${noteName(n, lang)} · ${staffPositionText(n)} → Griffbrett`;
  },
};
