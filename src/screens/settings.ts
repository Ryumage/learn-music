import type { GlobalSettings } from '../learn/store';
import { esc } from '../util/html';
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

export interface DataUi {
  exportText: string;
  importText: string;
  confirmImport: boolean;
  confirmReset: boolean;
  message: { ok: boolean; text: string } | null;
}

function dataSection(ui: DataUi): string {
  const msg = ui.message
    ? `<p class="data-msg ${ui.message.ok ? 'is-ok' : 'is-bad'}" role="status" data-testid="data-msg">${esc(ui.message.text)}</p>`
    : '';
  const importActions = ui.confirmImport
    ? `<p class="confirm-line">Aktuellen Lernstand durch den eingefügten ersetzen?</p>
       <div class="feedback-actions">
         <button type="button" class="btn" data-action="import-cancel">Abbrechen</button>
         <button type="button" class="btn btn-danger" data-action="import-confirm">Ersetzen</button>
       </div>`
    : `<button type="button" class="btn" data-action="import">Importieren</button>`;
  const resetActions = ui.confirmReset
    ? `<p class="confirm-line">Wirklich alles löschen? Antworten, Statistik und Einstellungen gehen verloren.</p>
       <div class="feedback-actions">
         <button type="button" class="btn" data-action="reset-cancel">Abbrechen</button>
         <button type="button" class="btn btn-danger" data-action="reset-confirm">Ja, alles löschen</button>
       </div>`
    : `<button type="button" class="btn" data-action="reset">Lernstand löschen</button>`;
  return `
    <section class="card settings-card" aria-labelledby="data-title">
      <h2 id="data-title" class="card-title">Lernstand</h2>
      <p class="muted small">Alles liegt nur auf diesem Gerät. Safari löscht Website-Daten nach 7 Tagen ohne Besuch – als Home-Bildschirm-App nicht. Sichere den Lernstand trotzdem ab und zu.</p>
      ${msg}
      <div class="setting">
        <h3 class="setting-label">Sichern</h3>
        <div class="chips">
          <button type="button" class="btn" data-action="export-copy">Lernstand kopieren</button>
          <button type="button" class="btn" data-action="export-file">Als Datei sichern</button>
        </div>
        <details class="export-details"><summary>Lernstand anzeigen</summary>
          <textarea class="data-text" readonly data-testid="export-text" aria-label="Lernstand als Text">${esc(ui.exportText)}</textarea>
        </details>
      </div>
      <div class="setting">
        <h3 class="setting-label">Wiederherstellen</h3>
        <textarea class="data-text" data-testid="import-text" aria-label="Gesicherten Lernstand einfügen" placeholder="Gesicherten Lernstand hier einfügen">${esc(ui.importText)}</textarea>
        ${importActions}
      </div>
      <div class="setting">
        <h3 class="setting-label">Löschen</h3>
        ${resetActions}
      </div>
    </section>`;
}

function installSection(installed: boolean): string {
  const body = installed
    ? '<p>Saitenlesen läuft als App vom Home-Bildschirm. Es funktioniert offline, Updates kommen beim nächsten Start von selbst.</p>'
    : `<ol class="install-steps">
        <li>Diese Seite in <strong>Safari</strong> öffnen.</li>
        <li>Unten auf <strong>Teilen</strong> tippen (Quadrat mit Pfeil nach oben).</li>
        <li><strong>Zum Home-Bildschirm</strong> wählen und <strong>Hinzufügen</strong> tippen.</li>
      </ol>
      <p class="muted small">Danach startet Saitenlesen ohne Browserleiste, läuft offline und Safari löscht den Lernstand nicht nach 7 Tagen. Updates kommen beim nächsten Start von selbst.</p>`;
  return `<section class="card settings-card" aria-labelledby="install-title" data-testid="install-section">
      <h2 id="install-title" class="card-title">Als App auf dem iPhone</h2>
      ${body}
    </section>`;
}

export function renderSettings(s: GlobalSettings, ui: DataUi, installed = false): string {
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
          <p class="muted small">Aufgaben zum Antippen auf dem Griffbrett laufen auf dem iPhone im Querformat.</p>
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
      ${installSection(installed)}
      ${dataSection(ui)}
      <section class="card about">
        <h2>Über Saitenlesen</h2>
        <p>Gitarre lesen lernen in kurzen Runden: Noten, Griffbrett, Saiten, Akkorde, Tabs und Rhythmus.
        Fehler kommen in derselben Runde und an den folgenden Tagen wieder (Leitner-System).
        Alles bleibt auf diesem Gerät, es gibt kein Konto und keinen Server.</p>
      </section>
    </main>`;
}
