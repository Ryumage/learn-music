import type { ModuleSettings, Store } from '../learn/store';
import type { Lang } from '../music/names';
import type { ModuleDef, SettingDef } from '../modules/types';
import { ICONS } from '../render/icons';
import { esc } from '../util/html';
import { statsLine } from './home';

function chips(def: SettingDef, value: ModuleSettings[string] | undefined, lang: Lang): string {
  if (def.type === 'toggle') {
    const on = value === true;
    return `<button type="button" class="chip${on ? ' is-on' : ''}" aria-pressed="${on}" data-action="setting" data-setting="${esc(def.id)}">${on ? 'an' : 'aus'}</button>`;
  }
  const selected = def.type === 'multi' ? ((value as string[]) ?? []) : [value as string];
  return (def.options ?? [])
    .map((o) => {
      const on = selected.includes(o.value);
      return `<button type="button" class="chip${on ? ' is-on' : ''}" aria-pressed="${on}" data-action="setting" data-setting="${esc(def.id)}" data-value="${esc(o.value)}">${esc(lang === 'en' && o.labelEn ? o.labelEn : o.label)}</button>`;
    })
    .join('');
}

/** Wendet einen Chip-Tipp an; bei Mehrfachauswahl bleibt mindestens eine Option aktiv. */
export function toggleSetting(def: SettingDef, settings: ModuleSettings, value?: string): ModuleSettings {
  const next = { ...settings };
  if (def.type === 'toggle') next[def.id] = !settings[def.id];
  else if (def.type === 'choice' && value !== undefined) next[def.id] = value;
  else if (def.type === 'multi' && value !== undefined) {
    const cur = (settings[def.id] as string[]) ?? [];
    const list = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    const order = (def.options ?? []).map((o) => o.value);
    if (list.length > 0) next[def.id] = order.filter((v) => list.includes(v));
  }
  return next;
}

export function dueKeys(mod: ModuleDef, settings: ModuleSettings, store: Store): string[] {
  return mod.keys(settings, store.settings.lang).filter((k) => store.isDue(k));
}

export function renderSetup(mod: ModuleDef, settings: ModuleSettings, store: Store, lang: Lang): string {
  const count = mod.count(settings);
  const due = dueKeys(mod, settings, store).length;
  const summary = store.summary(mod.prefixes);
  const rows = mod.settings
    .map(
      (d) => `<div class="setting">
        <h3 class="setting-label">${esc(d.label)}</h3>
        <div class="chips" role="group" aria-label="${esc(d.label)}">${chips(d, settings[d.id], lang)}</div>
      </div>`,
    )
    .join('');
  return `
    <main class="app">
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Zur Übersicht">${ICONS.back}</a>
        <h1 class="title-sm">${esc(mod.name)}</h1>
      </header>
      <p class="lead">${esc(mod.desc)}</p>
      <p class="muted" data-testid="module-stats">${esc(statsLine(summary))}</p>
      <section class="card settings-card">${rows}</section>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-action="start" data-testid="start">Los geht’s · ${count} ${mod.id === 'staff' ? (count === 1 ? 'Zeile' : 'Zeilen') : 'Fragen'}</button>
        <button type="button" class="btn" data-action="start-due"${due === 0 ? ' disabled' : ''}>Nur fällige üben (${due})</button>
      </div>
    </main>`;
}
