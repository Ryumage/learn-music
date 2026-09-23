import { MODULES } from '../modules/catalog';
import { esc } from '../util/html';

export interface HomeOptions {
  showInstallHint: boolean;
  baseUrl: string;
}

const GEAR_ICON =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

export function renderHome({ showInstallHint, baseUrl }: HomeOptions): string {
  const modules = MODULES.map(
    (m) => `
      <li class="card module">
        <span class="badge" aria-hidden="true">${esc(m.badge)}</span>
        <div>
          <h3>${esc(m.name)}</h3>
          <p>${esc(m.desc)}</p>
        </div>
        <span class="soon">bald</span>
      </li>`,
  ).join('');

  const installHint = showInstallHint
    ? `<p class="card install-hint" data-testid="install-hint">
        <strong>Tipp:</strong> In Safari auf <strong>Teilen → Zum Home-Bildschirm</strong> tippen.
        Dann startet Saitenlesen ohne Browserleiste, läuft offline und dein Lernstand bleibt erhalten.
      </p>`
    : '';

  return `
    <main class="app">
      <header class="topbar">
        <img class="logo" src="${esc(baseUrl)}favicon.svg" alt="" width="40" height="40" />
        <h1>Saitenlesen</h1>
        <button class="icon-btn" type="button" aria-label="Einstellungen (kommt bald)" disabled>${GEAR_ICON}</button>
      </header>

      <section class="card hero" aria-labelledby="hero-title">
        <span class="clef" aria-hidden="true">\u{1D120}</span>
        <h2 id="hero-title">Gitarre lesen lernen</h2>
        <p>Noten, Griffbrett, Saiten, Akkorde, Tabs und Rhythmus – in kurzen Runden, auch offline.</p>
      </section>

      <h2 class="section-title">Lernweg</h2>
      <ol class="module-list">${modules}</ol>

      ${installHint}

      <p class="footer">Die Übungen folgen Schritt für Schritt.</p>
    </main>`;
}
