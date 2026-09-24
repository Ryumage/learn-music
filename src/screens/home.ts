import type { Store } from '../learn/store';
import { MODULES } from '../modules/catalog';
import { ICONS } from '../render/icons';
import { esc } from '../util/html';

export interface HomeOptions {
  showInstallHint: boolean;
  baseUrl: string;
  store: Store;
  /** heute fällige Elemente über alle Module */
  due: number;
}

export function statsLine(s: { answers: number; correct: number; due: number }): string {
  if (s.answers === 0) return 'Noch nicht geübt';
  const pct = Math.round((100 * s.correct) / s.answers);
  return `${pct} % richtig · ${s.answers} ${s.answers === 1 ? 'Antwort' : 'Antworten'} · ${s.due} fällig`;
}

export function renderHome({ showInstallHint, baseUrl, store, due }: HomeOptions): string {
  const modules = MODULES.map((m) => {
    const inner = `
        <span class="badge" aria-hidden="true">${esc(m.badge)}</span>
        <div class="module-text">
          <h3>${esc(m.name)}</h3>
          <p>${esc(m.desc)}</p>
          ${m.def ? `<p class="module-stats">${esc(statsLine(store.summary(m.def.prefixes)))}</p>` : ''}
        </div>`;
    return m.def
      ? `<li><a class="card module is-ready" href="#/m/${esc(m.id)}" data-testid="module-${esc(m.id)}">${inner}<span class="chev">${ICONS.chevron}</span></a></li>`
      : `<li class="card module">${inner}<span class="soon">bald</span></li>`;
  }).join('');

  const today = store.today();
  const goal = store.settings.dailyGoal;
  const streak = store.streak();
  const progress = Math.min(100, Math.round((100 * today) / goal));

  const installHint = showInstallHint
    ? `<p class="card install-hint" data-testid="install-hint">
        <strong>Tipp:</strong> In Safari auf <strong>Teilen → Zum Home-Bildschirm</strong> tippen.
        Dann startet Saitenlesen ohne Browserleiste, läuft offline und dein Lernstand bleibt erhalten.
        (Safari löscht Website-Daten sonst nach 7 Tagen ohne Besuch.)
      </p>`
    : '';

  return `
    <main class="app">
      <header class="topbar">
        <img class="logo" src="${esc(baseUrl)}favicon.svg" alt="" width="40" height="40" />
        <h1>Saitenlesen</h1>
        <a class="icon-btn" href="#/settings" aria-label="Einstellungen">${ICONS.gear}</a>
      </header>

      <section class="card hero" aria-labelledby="hero-title">
        <span class="clef" aria-hidden="true">\u{1D120}</span>
        <h2 id="hero-title" data-testid="due">Heute fällig: ${due}</h2>
        <p class="goal-line">${today >= goal ? `Tagesziel erreicht ✓ ${today} Antworten` : `Tagesziel: ${today} von ${goal} Antworten`}</p>
        <div class="bar" role="progressbar" aria-label="Tagesziel" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(today, goal)}"><span style="width:${progress}%"></span></div>
        <p>${streak > 0 ? `${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge geübt.` : 'Kurze Runden, jeden Tag ein bisschen.'}</p>
        <button type="button" class="btn btn-primary daily-btn" data-action="start-daily" data-testid="start-daily"${due === 0 ? ' disabled' : ''}>${due === 0 ? 'Heute nichts fällig' : 'Tagesübung starten'}</button>
      </section>

      <h2 class="section-title">Lernweg</h2>
      <ol class="module-list">${modules}</ol>

      <h2 class="section-title">Werkzeuge</h2>
      <ul class="module-list">
        <li><a class="card module is-ready" href="#/stats" data-testid="tool-stats">
          <span class="badge" aria-hidden="true">%</span>
          <div class="module-text"><h3>Statistik</h3><p>Trefferquoten, Griffbrett-Heatmap und Schwachstellen.</p></div>
          <span class="chev">${ICONS.chevron}</span>
        </a></li>
      </ul>

      ${installHint}
    </main>`;
}
