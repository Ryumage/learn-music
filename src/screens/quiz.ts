import { renderChoices, type ChoiceState } from '../input/choices';
import { renderNoteFields, renderNoteKeyboard, type FieldState, type NoteInput } from '../input/noteKeyboard';
import type { Session } from '../learn/session';
import { isComplete } from '../learn/session';
import type { Lang } from '../music/names';
import { landscapeGeometry, renderFretboard, samePosition, type FretMarker, type FretView } from '../render/fretboard';
import type { MarkState } from '../render/staff';
import type { BoardSpec, ChordAnswer, ShapeAnswer, TapAnswer } from '../modules/types';
import { chordAnswerText, renderChordKeyboard } from '../input/chordKeyboard';
import { renderChordShape } from '../render/chordDiagram';
import type { Position } from '../music/guitar';
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
  fretView: FretView;
  sound: boolean;
  /** Telefon im Querformat: Griffbrett füllt Breite und Höhe */
  landscape: boolean;
  /** verfügbare Höhe für das Griffbrett in px (Querformat) */
  boardHeight: number;
  /** Telefon im Hochformat: Antipp-Aufgaben verlangen Querformat */
  portraitPhone: boolean;
}

const ROTATE_PROMPT = `<section class="rotate-prompt" data-testid="rotate-prompt" role="status">
    <svg class="rotate-icon" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="22" y="8" width="20" height="36" rx="4"/>
      <path d="M12 46a22 22 0 0 0 30 10" fill="none"/>
      <path d="M38 50l5 6-7 2" fill="none"/>
    </svg>
    <h2>Bitte iPhone quer halten</h2>
    <p>Zum Antippen braucht das Griffbrett die volle Breite – quer werden die Bünde groß genug.</p>
    <p class="muted small">Dreht sich nichts? Im Kontrollzentrum die Ausrichtungssperre ausschalten.</p>
  </section>`;

/** Breite der Spalte neben dem Griffbrett im Querformat (px, inkl. Abstand) */
const SIDE_WIDTH = { staff: 180, fields: 132 } as const;

function board(
  v: QuizView,
  spec: BoardSpec,
  markers: FretMarker[],
  tappable: boolean,
  beside?: keyof typeof SIDE_WIDTH,
): string {
  const width = beside ? v.width - SIDE_WIDTH[beside] : v.width;
  const geometry = v.landscape ? landscapeGeometry(spec.from, spec.to, width, v.boardHeight) : {};
  return `<div class="figure figure-board">${renderFretboard({
    ...geometry,
    from: spec.from,
    to: spec.to,
    view: v.fretView,
    labels: spec.labels ?? 'names',
    tappable: tappable ? spec.strings : [],
    active: spec.strings.length > 0 && spec.strings.length < 6 ? spec.strings : undefined,
    markers,
    lang: v.lang,
    label: spec.label,
  })}</div>`;
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
      : `${v.sound && q.sound?.length ? '<button type="button" class="btn" data-action="listen">▶ anhören</button>' : ''}<button type="button" class="btn btn-primary" data-action="next" data-testid="next">Weiter</button>`;
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
  const okNote = c.phase === 'correct' && q.kind === 'shape' && q.noteOk ? q.noteOk(c.answer as ShapeAnswer) : '';
  const body =
    c.phase === 'wrong'
      ? `<p>${esc(wrongMsg)}</p>`
      : `${okNote ? `<p><b>${esc(okNote)}</b></p>` : ''}${c.phase === 'revealed' && c.wrongText ? `<p>${esc(c.wrongText)}</p>` : ''}${partList}${q.explain}${q.after ?? ''}`;
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
    if (q.board) {
      const markers: FretMarker[] = q.board.points.map((p, i) => ({
        ...p,
        text: q.board!.points.length > 1 ? String(i + 1) : '?',
        state: answering ? null : c.parts[i] ? 'ok' : 'bad',
      }));
      answerArea = v.landscape
        ? `<div class="quiz-side quiz-side-fields">${board(v, q.board, markers, false, 'fields')}<div>${answerArea}</div></div>`
        : board(v, q.board, markers, false) + answerArea;
    }
  } else if (q.kind === 'tap') {
    const sel = (c.answer as TapAnswer | null) ?? [];
    const isTarget = (p: Position) => q.targets.some((t) => samePosition(t, p));
    const markers: FretMarker[] = sel.map((p) => ({
      ...p,
      state: answering ? 'active' : isTarget(p) ? 'ok' : 'bad',
    }));
    if (shown) {
      for (const t of q.targets) if (!sel.some((p) => samePosition(p, t))) markers.push({ ...t, state: 'solution' });
    }
    answerArea = board(v, q.board, markers, answering, v.landscape && q.figure ? 'staff' : undefined);
    if (shown && q.outside) answerArea += `<p class="muted small board-outside">${esc(q.outside)}</p>`;
    if (answering) {
      answerArea += `<p class="muted small tap-hint">${q.multi ? `Mehrere Stellen möglich – nochmal tippen hebt die Auswahl auf. Ausgewählt: ${sel.length}` : 'Tippe auf eine Stelle; ein neuer Tipp ersetzt die Auswahl.'}</p>`;
    }
  } else if (q.kind === 'chord') {
    const a = (c.answer as ChordAnswer | null) ?? { root: null, suffix: null };
    const text = chordAnswerText(a, v.lang);
    const st = answering ? '' : c.parts[0] ? ' is-ok' : ' is-bad';
    answerArea = `<div class="chord-answer${st}" data-testid="chord-answer" aria-live="polite">${text ? esc(text) : '<span class="muted">Grundton und Zusatz wählen</span>'}</div>`;
    if (answering) dockInput = renderChordKeyboard(a, v.lang);
  } else if (q.kind === 'shape') {
    const shape = (c.answer as ShapeAnswer | null) ?? [0, 0, 0, 0, 0, 0];
    const ok = c.parts[0];
    answerArea = `<div class="figure figure-chord">${renderChordShape({
      shape,
      editable: answering,
      names: q.names(shape),
      states: answering ? undefined : shape.map(() => (ok ? 'ok' : 'bad')),
      label: 'Griffdiagramm zum Bearbeiten',
    })}</div>${answering ? '<p class="muted small tap-hint">Punkt setzen: in die Zelle tippen, nochmal tippen entfernt ihn. Über dem Sattel: ○ leer / × nicht spielen.</p>' : ''}`;
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

  // Antipp-Aufgaben nur im Querformat (Telefon)
  const needsRotate = q.kind === 'tap' && v.portraitPhone;
  if (needsRotate) {
    answerArea = ROTATE_PROMPT;
    dockInput = '';
  }

  const checkBtn = answering && !needsRotate
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
    <div class="quiz${v.landscape ? ' is-landscape' : ''}">
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
        ${
          needsRotate
            ? answerArea
            : v.landscape && q.kind === 'tap' && q.figure
            ? `<div class="quiz-side"><div class="figure">${q.figure}</div><div>${answerArea}</div></div>`
            : `${q.figure ? `<div class="figure">${q.figure}</div>` : ''}${answerArea}`
        }
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
