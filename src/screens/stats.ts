import { heatmapData, weakest } from '../learn/stats';
import type { Store } from '../learn/store';
import { dueCount, moduleDue, moduleForKey } from '../modules/daily';
import type { ModuleDef } from '../modules/types';
import { renderHeatmap } from '../render/heatmap';
import { ICONS } from '../render/icons';
import { esc } from '../util/html';

export function renderStats(store: Store, mods: readonly ModuleDef[]): string {
  const lang = store.settings.lang;
  const rows = mods
    .map((m) => {
      const s = store.summary(m.prefixes);
      const pct = s.answers ? `${Math.round((100 * s.correct) / s.answers)} %` : '–';
      return `<tr><th scope="row">${esc(m.name)}</th><td>${pct}</td><td>${s.answers}</td><td>${moduleDue(store, m).length}</td></tr>`;
    })
    .join('');
  const weak = weakest(store.data.items, null, 10);
  const weakList = weak.length
    ? `<ol class="weak-list">${weak
        .map((w) => {
          const mod = moduleForKey(w.key, mods);
          const label = mod ? mod.label(w.key, lang) : w.key;
          const pct = Math.round(w.errorRate * 100);
          return `<li><span class="weak-label">${esc(label)}</span><span class="weak-bar" style="--w:${pct}%"><span></span></span><span class="weak-num">${w.n - w.c}/${w.n} falsch</span></li>`;
        })
        .join('')}</ol>`
    : '<p class="muted">Noch keine Fehler – weiter so.</p>';
  const heat = heatmapData(store.data.items);

  return `
    <main class="app stats-page">
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Zur Übersicht">${ICONS.back}</a>
        <h1 class="title-sm">Statistik</h1>
      </header>
      <dl class="kpis" data-testid="stats-kpis">
        <div class="card"><dt>Antworten gesamt</dt><dd>${store.totalAnswers()}</dd></div>
        <div class="card"><dt>Heute</dt><dd>${store.today()}</dd></div>
        <div class="card"><dt>Tage in Folge</dt><dd>${store.streak()}</dd></div>
        <div class="card"><dt>Fällig</dt><dd>${dueCount(store, mods)}</dd></div>
      </dl>
      <h2 class="section-title">Module</h2>
      <div class="card table-card">
        <table class="stats-table">
          <thead><tr><th scope="col">Modul</th><th scope="col">Quote</th><th scope="col">Antworten</th><th scope="col">Fällig</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <h2 class="section-title">Griffbrett</h2>
      <div class="card">${heat.size ? renderHeatmap(heat, lang, store.settings.fretView) : '<p class="muted">Noch keine Griffbrett-Antworten (Modul „Griffbrett“).</p>'}</div>
      <h2 class="section-title">Top 10 Schwachstellen</h2>
      <div class="card">${weakList}</div>
    </main>`;
}
