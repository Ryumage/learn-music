import type { Session } from '../learn/session';
import { ICONS } from '../render/icons';
import { esc } from '../util/html';

export interface SummaryData {
  total: number;
  firstCorrect: number;
  partsTotal: number;
  partsCorrect: number;
  retriesTotal: number;
  retriesCorrect: number;
  ms: number;
  mistakes: { label: string; solution: string; key: string }[];
}

export function summarize(session: Session, endedAt: number): SummaryData {
  const regular = session.results.filter((r) => !r.isRetry);
  const retries = session.results.filter((r) => r.isRetry);
  const mistakes = regular
    .filter((r) => !r.firstCorrect)
    .flatMap((r) => {
      const q = r.question;
      // Notenzeilen: jede falsche Note einzeln
      if (q.kind === 'notes' && q.fieldItems && q.partSolutions) {
        return q.fieldItems
          .map((key, i) => ({ key, i }))
          .filter(({ i }) => !r.firstParts[i])
          .map(({ key, i }) => ({ label: 'Note im System', solution: q.partSolutions![i]!, key }));
      }
      return [{ label: q.prompt, solution: q.solution, key: q.items[0] ?? '' }];
    });
  return {
    total: regular.length,
    firstCorrect: regular.filter((r) => r.firstCorrect).length,
    partsTotal: regular.reduce((a, r) => a + r.partsTotal, 0),
    partsCorrect: regular.reduce((a, r) => a + r.partsCorrect, 0),
    retriesTotal: retries.length,
    retriesCorrect: retries.filter((r) => r.firstCorrect).length,
    ms: endedAt - session.startedAt,
    mistakes,
  };
}

export function verdict(pct: number): string {
  if (pct === 100) return 'Perfekt – alles auf Anhieb richtig.';
  if (pct >= 85) return 'Sehr gut, das sitzt schon fast.';
  if (pct >= 60) return 'Gut – die Fehler kommen in den nächsten Tagen wieder.';
  return 'Dranbleiben: Die schwierigen Stellen kommen öfter dran, bis sie sitzen.';
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

function ring(pct: number): string {
  const r = 52;
  const circ = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="${pct} Prozent">
      <circle class="ring-bg" cx="60" cy="60" r="${r}"/>
      <circle class="ring-fg" cx="60" cy="60" r="${r}" stroke-dasharray="${((circ * pct) / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 60 60)"/>
      <text x="60" y="68" text-anchor="middle">${pct} %</text>
    </svg>`;
}

export function renderSummary(data: SummaryData, streak: number): string {
  const pct = data.total ? Math.round((100 * data.firstCorrect) / data.total) : 0;
  const multi = data.partsTotal > data.total;
  const mistakes = data.mistakes.length
    ? `<h2 class="section-title">Fehler</h2>
       <ul class="mistakes">${data.mistakes
         .map((m) => `<li class="card"><span>${esc(m.label)}</span><strong>${esc(m.solution)}</strong></li>`)
         .join('')}</ul>`
    : '';
  return `
    <main class="app summary">
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Zur Übersicht">${ICONS.back}</a>
        <h1 class="title-sm">Auswertung</h1>
      </header>
      <section class="card summary-hero" data-testid="summary">
        ${ring(pct)}
        <p class="summary-main"><strong>${data.firstCorrect} von ${data.total}</strong> Fragen auf Anhieb richtig</p>
        <p class="muted">${esc(verdict(pct))}</p>
      </section>
      <dl class="kpis">
        ${multi ? `<div class="card"><dt>Einzelne Antworten</dt><dd>${data.partsCorrect} / ${data.partsTotal}</dd></div>` : ''}
        <div class="card"><dt>Wiederholungen richtig</dt><dd>${data.retriesCorrect} / ${data.retriesTotal}</dd></div>
        <div class="card"><dt>Dauer</dt><dd>${esc(formatDuration(data.ms))}</dd></div>
        <div class="card"><dt>Tage in Folge</dt><dd>${streak}</dd></div>
      </dl>
      ${mistakes}
      <div class="actions">
        ${data.mistakes.length ? '<button type="button" class="btn btn-primary" data-action="practice-mistakes">Fehler üben</button>' : ''}
        <button type="button" class="btn${data.mistakes.length ? '' : ' btn-primary'}" data-action="restart">Neue Runde</button>
        <a class="btn" href="#/">Zur Übersicht</a>
      </div>
    </main>`;
}
