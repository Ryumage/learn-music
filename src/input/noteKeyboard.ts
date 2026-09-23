import { letterName, noteName, type Lang } from '../music/names';
import type { Spelling } from '../music/notes';
import { esc } from '../util/html';

/** Zustand der Notenfelder einer Frage. */
export interface NoteInput {
  answer: (Spelling | null)[];
  locked: boolean[];
  /** Feld mit Cursor */
  active: number;
  /** zuletzt eingegebenes Feld (für ♯/♭) */
  last: number | null;
}

export function createInput(answer: (Spelling | null)[], locked: boolean[]): NoteInput {
  const input: NoteInput = { answer: [...answer], locked: [...locked], active: 0, last: null };
  input.active = nextEmpty(input, -1) ?? 0;
  return input;
}

function nextEmpty(st: NoteInput, from: number): number | null {
  const n = st.answer.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k + n) % n;
    if (!st.locked[i] && !st.answer[i]) return i;
  }
  return null;
}

/** Buchstabe setzt die Note ins aktive Feld; der Cursor springt zum nächsten leeren Feld. */
export function pressLetter(st: NoteInput, letter: number, acc = 0): NoteInput {
  if (st.locked[st.active]) return st;
  const answer = [...st.answer];
  answer[st.active] = { letter, acc };
  const next: NoteInput = { ...st, answer, last: st.active };
  next.active = nextEmpty(next, st.active) ?? st.active;
  return next;
}

/** ♯/♭ ändern die zuletzt eingegebene Note; zweiter Druck schaltet zurück. */
export function pressAccidental(st: NoteInput, acc: 1 | -1): NoteInput {
  const i = st.last;
  if (i === null || !st.answer[i] || st.locked[i]) return st;
  const answer = [...st.answer];
  const cur = answer[i]!;
  answer[i] = { letter: cur.letter, acc: cur.acc === acc ? 0 : acc };
  return { ...st, answer };
}

/** ⌫ leert das aktive Feld oder, wenn es leer ist, das vorherige. */
export function pressBackspace(st: NoteInput): NoteInput {
  const answer = [...st.answer];
  let i = st.active;
  if (!answer[i] || st.locked[i]) {
    let j = i - 1;
    while (j >= 0 && (st.locked[j] || !answer[j])) j--;
    if (j < 0) return st;
    i = j;
  }
  answer[i] = null;
  return { ...st, answer, active: i, last: null };
}

export function selectField(st: NoteInput, i: number): NoteInput {
  if (i < 0 || i >= st.answer.length || st.locked[i]) return st;
  return { ...st, active: i, last: st.answer[i] ? i : st.last };
}

export function renderNoteKeyboard(lang: Lang, accidentals: boolean, disabled = false): string {
  const dis = disabled ? ' disabled' : '';
  const letters = [0, 1, 2, 3, 4, 5, 6]
    .map((l) => `<button type="button" class="key" data-action="letter" data-letter="${l}"${dis}>${esc(letterName(l, lang))}</button>`)
    .join('');
  const accRow = accidentals
    ? `<div class="key-row">
        <button type="button" class="key key-acc" data-action="acc" data-acc="1" aria-label="Kreuz"${dis}>♯${lang === 'de' ? '<small>-is</small>' : ''}</button>
        <button type="button" class="key key-acc" data-action="acc" data-acc="-1" aria-label="Be"${dis}>♭${lang === 'de' ? '<small>-es</small>' : ''}</button>
        <button type="button" class="key key-back" data-action="backspace" aria-label="Löschen"${dis}>⌫</button>
      </div>
      <p class="key-hint">${lang === 'de' ? 'H + ♭ = B, E + ♭ = Es, A + ♭ = As' : '♯/♭ ändern die zuletzt getippte Note.'}</p>`
    : '';
  const backInRow = accidentals
    ? ''
    : `<button type="button" class="key key-back" data-action="backspace" aria-label="Löschen"${dis}>⌫</button>`;
  return `<div class="keyboard" role="group" aria-label="Notentastatur">
      <div class="key-row key-row-letters${accidentals ? '' : ' with-back'}">${letters}${backInRow}</div>
      ${accRow}
    </div>`;
}

export type FieldState = 'ok' | 'bad' | 'solution' | null;

/** Antwortfelder als Buttons (keine <input>, damit die iOS-Tastatur zu bleibt). */
export function renderNoteFields(
  input: NoteInput,
  lang: Lang,
  opts: { labels?: (string | undefined)[]; states?: FieldState[]; solution?: (Spelling | null)[]; interactive: boolean },
): string {
  return `<div class="note-fields" role="group" aria-label="Antwortfelder">${input.answer
    .map((a, i) => {
      const st = opts.states?.[i] ?? null;
      const active = opts.interactive && i === input.active && !input.locked[i];
      const text = a ? noteName(a, lang) : '';
      const sol = opts.solution?.[i];
      const label = opts.labels?.[i];
      const cls = ['note-field', active ? 'is-active' : '', st ? `is-${st}` : '', input.locked[i] ? 'is-locked' : '']
        .filter(Boolean)
        .join(' ');
      const aria = `${label ? `Feld ${label}` : `Feld ${i + 1}`}: ${text || 'leer'}`;
      return `<div class="note-field-wrap">
          ${label ? `<span class="note-field-label">${esc(label)}</span>` : ''}
          <button type="button" class="${cls}" data-action="field" data-field="${i}" aria-label="${esc(aria)}"${opts.interactive ? '' : ' disabled'}>${esc(text) || '&nbsp;'}</button>
          ${sol ? `<span class="note-field-solution">${esc(noteName(sol, lang))}</span>` : ''}
        </div>`;
    })
    .join('')}</div>`;
}
