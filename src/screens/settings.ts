import type { GlobalSettings } from '../learn/store';
import { renderFretboard } from '../render/fretboard';
import { ICONS } from '../render/icons';

function segmented(id: string, options: [string, string][], value: string, label: string): string {
  return `<div class="chips" role="group" aria-label="${label}">${options
    .map(
      ([v, l]) =>
        `<button type="button" class="chip${v === value ? ' is-on' : ''}" aria-pressed="${v === value}" data-action="global" data-setting="${id}" data-value="${v}">${l}</button>`,
    )
    .join('')}</div>`;
}

export function renderSettings(s: GlobalSettings): string {
  return `
    <main class="app">
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Zur Übersicht">${ICONS.back}</a>
        <h1 class="title-sm">Einstellungen</h1>
      </header>
      <section class="card settings-card">
        <div class="setting">
          <h3 class="setting-label">Notennamen</h3>
          ${segmented('lang', [['de', 'Deutsch (H, Cis, Es)'], ['en', 'Englisch (B, C♯, E♭)']], s.lang, 'Notennamen')}
          <p class="muted small">Akkordsymbole bleiben immer international (Bm, B7) – wie auf Ultimate Guitar.</p>
        </div>
        <div class="setting">
          <h3 class="setting-label">Griffbrett-Ansicht</h3>
          ${segmented('fretView', [['low-bottom', 'Tiefe E-Saite unten'], ['low-top', 'Tiefe E-Saite oben']], s.fretView, 'Griffbrett-Ansicht')}
          <p class="muted small">${s.fretView === 'low-bottom' ? 'Wie im Tab und im Cheat Sheet „Standard View“: Sattel links.' : 'Spieler-Sicht wie im Cheat Sheet „Student View“: Sattel rechts.'}</p>
          <p class="muted small">Tipp für Griffbrett-Aufgaben: iPhone quer halten, dann werden die Bünde breiter.</p>
          <div class="figure figure-preview" data-testid="fret-preview">${renderFretboard({ from: 0, to: 4, view: s.fretView, labels: 'names', lang: s.lang, label: 'Vorschau Griffbrett' })}</div>
        </div>
        <div class="setting">
          <h3 class="setting-label">Ton</h3>
          ${segmented('sound', [['on', 'an'], ['off', 'aus']], s.sound ? 'on' : 'off', 'Ton')}
          <button type="button" class="btn btn-small" data-action="sound-test">▶ Probe: alle Leersaiten</button>
          <p class="muted small">Auf dem iPhone muss der Stummschalter aus sein, sonst bleibt es still.</p>
        </div>
        <div class="setting">
          <h3 class="setting-label">Merkhilfen</h3>
          ${segmented('hints', [['on', 'an'], ['off', 'aus']], s.hints ? 'on' : 'off', 'Merkhilfen')}
        </div>
        <div class="setting">
          <h3 class="setting-label">Tagesziel</h3>
          ${segmented('dailyGoal', [['10', '10'], ['20', '20'], ['40', '40'], ['60', '60']], String(s.dailyGoal), 'Tagesziel')}
          <p class="muted small">Antworten pro Tag</p>
        </div>
      </section>
      <section class="card about">
        <h2>Über Saitenlesen</h2>
        <p>Gitarre lesen lernen in kurzen Runden: Noten, Griffbrett, Saiten, Akkorde, Tabs und Rhythmus.
        Fehler kommen in derselben Runde und an den folgenden Tagen wieder (Leitner-System).
        Alles bleibt auf diesem Gerät, es gibt kein Konto und keinen Server.</p>
      </section>
    </main>`;
}
