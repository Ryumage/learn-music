import { chordTitle } from '../modules/chords';
import { suffixLabel } from '../input/chordKeyboard';
import { CHORD_TYPES, gripById, LIBRARY, voicingId, voicingLabel } from '../music/chordLibrary';
import { chordTones, formulaText, parseChord, parseShape, UG_ROOTS, type ChordSuffix } from '../music/chords';
import { noteName, type Lang } from '../music/names';
import { renderChordShape } from '../render/chordDiagram';
import { ICONS } from '../render/icons';
import { esc } from '../util/html';

export interface LibraryUi {
  /** Grundton (Index in UG_ROOTS) */
  root: number;
  /** Akkordtyp (Zusatz) oder „all“ */
  type: string;
  /** gewählter Griff (Bibliotheks-Kennung) */
  selected: string | null;
}

export function newLibraryUi(saved: Record<string, unknown>): LibraryUi {
  const root = Number(saved.root);
  const type = String(saved.type ?? 'all');
  return {
    root: Number.isInteger(root) && root >= 0 && root < 12 ? root : 0,
    type: type === 'all' || CHORD_TYPES.some((t) => t.suffix === type) ? type : 'all',
    selected: null,
  };
}

/** Grundton-Beschriftung: im Deutsch-Modus mit deutschem Namen, wo er abweicht (B → H, Bb → B). */
function rootLabel(i: number, lang: Lang): string {
  const name = UG_ROOTS[i]!;
  if (lang !== 'de') return name;
  const de = noteName(parseChord(name).root, 'de');
  return de === name ? name : `${name} (${de})`;
}

function chip(action: string, attr: string, value: string, label: string, on: boolean): string {
  return `<button type="button" class="chip${on ? ' is-on' : ''}" data-action="${action}" data-${attr}="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;
}

export interface LibraryView {
  lang: Lang;
  /** aktuelle Auswahl im Akkordwechsel-Trainer */
  trainer: { a: string; b: string };
}

export function renderLibrary(ui: LibraryUi, v: LibraryView): string {
  const chords = LIBRARY.filter((c) => c.root === ui.root && (ui.type === 'all' || c.suffix === ui.type));
  const roots = UG_ROOTS.map((_, i) => chip('lib-root', 'root', String(i), rootLabel(i, v.lang), i === ui.root)).join('');
  const types = [chip('lib-type', 'type', 'all', 'Alle', ui.type === 'all'), ...CHORD_TYPES.map((t) => chip('lib-type', 'type', t.suffix, suffixLabel(t.suffix), ui.type === t.suffix))].join('');

  const sections = chords
    .map((c) => {
      const sym = parseChord(c.symbol);
      const tones = chordTones(sym)
        .map((t) => noteName(t, v.lang))
        .join(' ');
      const typeName = CHORD_TYPES.find((t) => t.suffix === c.suffix)!.name;
      const grips = c.voicings
        .map((voicing) => {
          const id = voicingId(c.symbol, voicing);
          const on = ui.selected === id;
          const where = voicingLabel(voicing);
          return `<button type="button" class="lib-voicing${on ? ' is-on' : ''}" data-action="lib-pick" data-id="${esc(id)}" aria-pressed="${on}" aria-label="${esc(`${c.symbol}, ${where}, anhören`)}">
              ${renderChordShape({ shape: parseShape(voicing.shape), fingers: voicing.fingers, label: `Akkorddiagramm ${c.symbol}, ${where}` })}
              <span class="lib-voicing-label">${esc(where)}</span>
            </button>`;
        })
        .join('');
      return `<section class="card lib-chord" aria-labelledby="lib-${esc(c.symbol)}">
          <h2 id="lib-${esc(c.symbol)}" class="lib-title">${esc(chordTitle(sym, c.symbol, v.lang))} <span class="muted small">${esc(typeName)}</span></h2>
          <p class="muted small">${esc(formulaText(c.suffix as ChordSuffix))}. Töne: <b>${esc(tones)}</b></p>
          <div class="lib-voicings">${grips}</div>
        </section>`;
    })
    .join('');

  const selected = gripById(ui.selected ?? undefined);
  const inTrainer = (slot: 'a' | 'b') => (selected && v.trainer[slot] === selected.id ? ' ✓' : '');
  const dock = selected
    ? `<div class="dock"><div class="dock-inner lib-dock" data-testid="lib-dock">
          <p class="lib-dock-title"><b>${esc(selected.label)}</b> · ${esc(selected.shape)}</p>
          <div class="lib-dock-actions">
            <button type="button" class="btn" data-action="lib-play">▶ Anhören</button>
            <button type="button" class="btn" data-action="lib-use" data-slot="a">Als Akkord 1${inTrainer('a')}</button>
            <button type="button" class="btn" data-action="lib-use" data-slot="b">Als Akkord 2${inTrainer('b')}</button>
          </div>
        </div></div>`
    : '';

  return `<main class="app library-page${selected ? ' has-dock' : ''}">
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Zur Übersicht">${ICONS.back}</a>
        <h1 class="title-sm">Akkord-Bibliothek</h1>
      </header>
      <p class="lead">12 Grundtöne × 17 Akkordtypen: offene Griffe und verschiebbare Griffe mit dem Grundton auf der E- oder A-Saite. Griff antippen zum Anhören und für den Akkordwechsel-Trainer.</p>
      <section class="card settings-card">
        <div class="setting"><h3 class="setting-label">Grundton</h3><div class="chips" role="group" aria-label="Grundton">${roots}</div></div>
        <div class="setting"><h3 class="setting-label">Akkordtyp</h3><div class="chips" role="group" aria-label="Akkordtyp">${types}</div></div>
      </section>
      <p class="muted small" data-testid="lib-count">${chords.length} ${chords.length === 1 ? 'Akkord' : 'Akkorde'}, ${chords.reduce((n, c) => n + c.voicings.length, 0)} Griffe</p>
      ${sections}
    </main>${dock}`;
}
