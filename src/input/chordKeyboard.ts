import { chordSpoken, chordSymbol, type ChordSuffix } from '../music/chords';
import type { Lang } from '../music/names';
import type { ChordAnswer } from '../modules/types';
import { esc } from '../util/html';

/** Die Zusätze der ersten Version – Standardbelegung der Tastatur. */
export const CLASSIC_SUFFIXES: readonly ChordSuffix[] = ['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', 'add9', '5'];

export const SUFFIX_KEYS: { value: ChordSuffix; label: string }[] = CLASSIC_SUFFIXES.map((value) => ({ value, label: suffixLabel(value) }));

export function suffixLabel(s: ChordSuffix): string {
  return s === '' ? 'Dur' : s;
}

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
export function renderChordKeyboard(a: ChordAnswer, lang: Lang, suffixList: readonly string[] = CLASSIC_SUFFIXES): string {
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
  const suffixes = suffixList
    .map((value) => {
      const on = a.suffix === value;
      return `<button type="button" class="key key-suffix${on ? ' is-on' : ''}" data-action="chord-suffix" data-suffix="${esc(value)}" aria-pressed="${on}">${esc(suffixLabel(value as ChordSuffix))}</button>`;
    })
    .join('');
  return `<div class="keyboard chord-keyboard" role="group" aria-label="Akkordtastatur">
      <div class="key-row key-row-letters">${roots}</div>
      <div class="key-row chord-row-acc">${accs}</div>
      <div class="key-row chord-row-suffix">${suffixes}</div>
    </div>`;
}
