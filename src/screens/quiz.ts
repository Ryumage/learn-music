import { renderChoices, type ChoiceState } from '../input/choices';
import { renderNoteFields, renderNoteKeyboard, type FieldState, type NoteInput } from '../input/noteKeyboard';
import type { Session } from '../learn/session';
import { isComplete } from '../learn/session';
import type { Lang } from '../music/names';
import type { MarkState } from '../render/staff';
import { renderStaffRow } from './staffRow';
import { ICONS } from '../render/icons';
import { esc } from '../util/html';

export interface QuizView {
  session: Session;
  input: NoteInput | null;
  lang: Lang;
  hints: boolean;
  confirmAbort: boolean;
  /** verfügbare Breite für Grafiken in px */
  width: number;
}

function feedback(v: QuizView): string {
  const c = v.session.current!;
  if (c.phase === 'answering') return '';
  const q = c.question;
  const title = { correct: 'Richtig!', wrong: 'Leider nicht ganz.', revealed: 'Lösung' }[c.phase];
  const cls = c.phase === 'correct' ? 'is-ok' : c.phase === 'wrong' ? 'is-bad' : 'is-solution';
  const buttons =
    c.phase === 'wrong'
      ? `<button type="button" class="btn" data-action="retry">Nochmal</button>
         <button type="button" class="btn btn-primary" data-action="reveal">Lösung zeigen</button>`
      : `<button type="button" class="btn btn-primary" data-action="next" data-testid="next">Weiter</button>`;
  const wrongCount = c.parts.filter((ok) => !ok).length;
  const partList =
    c.phase === 'revealed' && q.kind === 'notes' && q.partSolutions
      ? `<ul class="part-solutions">${q.partSolutions
          .filter((_, i) => !c.parts[i])
          .map((t) => `<li>${esc(t)}</li>`)
          .join('')}</ul>`
      : '';
  const wrongMsg =
    c.wrongText ||
    (q.kind === 'notes' && q.fields.length > 1
      ? `${wrongCount} von ${q.fields.length} ${q.fields.length === 1 ? 'Antwort' : 'Antworten'} stimmen nicht. Die roten Felder werden bei „Nochmal“ geleert.`
      : 'Die Antwort stimmt nicht.');
  const body =
    c.phase === 'wrong'
      ? `<p>${esc(wrongMsg)}</p>`
      : `${c.phase === 'revealed' && c.wrongText ? `<p>${esc(c.wrongText)}</p>` : ''}${partList}${q.explain}${q.after ?? ''}`;
  return `<section class="feedback ${cls}" role="status" aria-live="polite" data-testid="feedback">
      <h2>${title}</h2>
      ${body}
      <div class="feedback-actions">${buttons}</div>
    </section>`;
}

export function renderQuiz(v: QuizView): string {
  const s = v.session;
  const c = s.current!;
  const q = c.question;
  const answering = c.phase === 'answering';
  const shown = c.phase === 'revealed' || c.phase === 'correct';
  const progress = Math.round((100 * (c.number - (c.phase === 'answering' ? 1 : 0))) / s.total);

  let answerArea = '';
  let dockInput = '';
  if (q.kind === 'notes' && v.input) {
    const states: FieldState[] =
      c.phase === 'answering'
        ? v.input.locked.map((l) => (l ? 'ok' : null))
        : c.parts.map((ok) => (ok ? 'ok' : 'bad'));
    const fieldOpts = {
      labels: q.fields.map((f) => f.label),
      states,
      solution: c.phase === 'revealed' ? q.fields.map((f, i) => (c.parts[i] ? null : f.answer)) : undefined,
      interactive: answering,
    };
    answerArea = q.staff
      ? `<div class="figure-staff">${renderStaffRow({
          columns: q.staff.columns,
          fields: q.staff.fields,
          input: v.input,
          lang: v.lang,
          width: v.width,
          fieldOpts,
          states: states.map((st) => (st === 'ok' ? 'ok' : st === 'bad' ? 'bad' : null)) as MarkState[],
        })}</div>`
      : renderNoteFields(v.input, v.lang, fieldOpts);
    if (answering) dockInput = renderNoteKeyboard(v.lang, q.accidentals);
  } else if (q.kind === 'choice') {
    const sel = typeof c.answer === 'number' ? c.answer : null;
    const states: ChoiceState[] = q.options.map((_, i) => {
      if (answering) return null;
      if (i === q.correct && shown) return c.phase === 'correct' ? 'ok' : 'solution';
      if (i === sel && !c.parts[0]) return 'bad';
      return null;
    });
    answerArea = renderChoices(q.options, answering ? sel : null, { interactive: answering, states });
  }

  const checkBtn = answering
    ? `<button type="button" class="btn btn-primary btn-check" data-action="check" data-testid="check"${isComplete(q, c.answer) ? '' : ' disabled'}>Prüfen</button>`
    : '';

  const abort = v.confirmAbort
    ? `<div class="confirm" role="alertdialog" aria-labelledby="confirm-title">
        <div class="card confirm-card">
          <h2 id="confirm-title">Runde abbrechen?</h2>
          <p>Deine bisherigen Antworten bleiben gespeichert.</p>
          <div class="feedback-actions">
            <button type="button" class="btn" data-action="abort-cancel">Weiter üben</button>
            <button type="button" class="btn btn-danger" data-action="abort-confirm">Abbrechen</button>
          </div>
        </div>
      </div>`
    : '';

  return `
    <div class="quiz">
      <header class="quiz-head">
        <div class="quiz-head-row">
          <button type="button" class="icon-btn" data-action="abort" aria-label="Runde abbrechen">${ICONS.close}</button>
          <span class="quiz-title">${esc(s.module.name)}</span>
          <span class="quiz-count" data-testid="count">${c.number} / ${s.total}</span>
        </div>
        <div class="bar" aria-hidden="true"><span style="width:${progress}%"></span></div>
      </header>
      <main class="app quiz-body">
        ${c.isRetry ? '<p class="retry-badge">Wiederholung</p>' : ''}
        <h1 class="prompt" data-testid="prompt">${esc(q.prompt)}</h1>
        ${q.figure ? `<div class="figure">${q.figure}</div>` : ''}
        ${answerArea}
        ${v.hints && q.hint ? `<details class="hint"><summary>Merkhilfe</summary>${q.hint}</details>` : ''}
      </main>
      <div class="dock">
        <div class="dock-inner">
          ${feedback(v)}
          ${dockInput}
          ${checkBtn}
        </div>
      </div>
      ${abort}
    </div>`;
}
