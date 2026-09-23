import { esc } from '../util/html';

export type ChoiceState = 'ok' | 'bad' | 'solution' | null;

export function renderChoices(
  options: string[],
  selected: number | null,
  opts: { interactive: boolean; states?: ChoiceState[] },
): string {
  return `<div class="choices" role="group" aria-label="Antwortmöglichkeiten">${options
    .map((o, i) => {
      const st = opts.states?.[i] ?? null;
      const cls = ['choice', selected === i ? 'is-selected' : '', st ? `is-${st}` : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-action="choice" data-choice="${i}" aria-pressed="${selected === i}"${opts.interactive ? '' : ' disabled'}><span class="choice-key">${i + 1}</span>${esc(o)}</button>`;
    })
    .join('')}</div>`;
}
