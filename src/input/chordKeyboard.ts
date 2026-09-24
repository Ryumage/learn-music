import { chordSpoken, chordSymbol, type ChordSuffix } from '../music/chords';
import type { Lang } from '../music/names';
import type { ChordAnswer } from '../modules/types';
import { esc } from '../util/html';

export const SUFFIX_KEYS: { value: ChordSuffix; label: string }[] = [
  { value: '', label: 'Dur' },
  { value: 'm', label: 'm' },
  { value: '7', label: '7' },
  { value: 'm7', label: 'm7' },
  { value: 'maj7', label: 'maj7' },
  { value: 'sus2', label: 'sus2' },
  { value: 'sus4', label: 'sus4' },
  { value: 'add9', label: 'add9' },
  { value: '5', label: '5' },
];

export function pressRoot(a: ChordAnswer, letter: number): ChordAnswer {
  return { ...a, root: { letter, acc: 0 } };
}

/** # und b wirken auf den gewählten Grundton; zweiter Druck schaltet zurück. */
export function pressChordAccidental(a: ChordAnswer, acc: 1 | -1): ChordAnswer {
  if (!a.root) return a;
  return { ...a, root: { letter: a.root.letter, acc: a.root.acc === acc ? 0 : acc } };
}

export function pressSuffix(a: ChordAnswer, suffix: string): ChordAnswer {
  return { ...a, suffix };
}

/** Anzeige des getippten Symbols, z. B. „F#m“ (plus deutsche Aussprache). */
export function chordAnswerText(a: ChordAnswer, lang: Lang): string {
  if (!a.root) return '';
  const symbol = chordSymbol({ root: a.root, suffix: (a.suffix ?? '') as ChordSuffix });
  if (a.suffix === null) return symbol;
  const spoken = chordSpoken({ root: a.root, suffix: a.suffix as ChordSuffix }, 'de');
  return lang === 'de' && spoken !== symbol ? `${symbol} (${spoken})` : symbol;
}

/** Akkordtastatur: Grundton C–B (im Deutsch-Modus B mit „= H“), # und b, Zusätze. */
export function renderChordKeyboard(a: ChordAnswer, lang: Lang): string {
  const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    .map((l, i) => {
      const on = a.root?.letter === i;
      const sub = lang === 'de' && l === 'B' ? '<small>= H</small>' : '';
      return `<button type="button" class="key${on ? ' is-on' : ''}" data-action="chord-root" data-letter="${i}" aria-pressed="${on}">${l}${sub}</button>`;
    })
    .join('');
  const accs = ([
    [1, '#'],
    [-1, 'b'],
  ] as const)
    .map(([acc, label]) => {
      const on = a.root?.acc === acc;
      return `<button type="button" class="key key-acc${on ? ' is-on' : ''}" data-action="chord-acc" data-acc="${acc}" aria-pressed="${on}"${a.root ? '' : ' disabled'}>${label}</button>`;
    })
    .join('');
  const suffixes = SUFFIX_KEYS.map((s) => {
    const on = a.suffix === s.value;
    return `<button type="button" class="key key-suffix${on ? ' is-on' : ''}" data-action="chord-suffix" data-suffix="${esc(s.value)}" aria-pressed="${on}">${esc(s.label)}</button>`;
  }).join('');
  return `<div class="keyboard chord-keyboard" role="group" aria-label="Akkordtastatur">
      <div class="key-row key-row-letters">${roots}</div>
      <div class="key-row chord-row-acc">${accs}</div>
      <div class="key-row chord-row-suffix">${suffixes}</div>
    </div>`;
}
