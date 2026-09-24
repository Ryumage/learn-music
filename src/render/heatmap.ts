import type { Tally } from '../learn/stats';
import { stringLetter, type StringNo } from '../music/guitar';
import type { Lang } from '../music/names';
import { esc } from '../util/html';

/**
 * Griffbrett-Heatmap (Bund 0–12): Farbe = Trefferquote, grau = noch nicht geübt.
 * Eigener Scroll-Container, damit die Seite keine horizontale Scrollleiste bekommt.
 */
export function renderHeatmap(data: Map<string, Tally>, lang: Lang, view: 'low-bottom' | 'low-top' = 'low-bottom'): string {
  const strings: StringNo[] = view === 'low-bottom' ? [1, 2, 3, 4, 5, 6] : [6, 5, 4, 3, 2, 1];
  const frets = Array.from({ length: 13 }, (_, i) => i);
  const head = `<tr><th scope="col"></th>${frets.map((f) => `<th scope="col">${f}</th>`).join('')}</tr>`;
  const rows = strings
    .map((s) => {
      const cells = frets
        .map((f) => {
          const t = data.get(`${s}:${f}`);
          if (!t || t.n === 0) return `<td class="hm-none" title="noch nicht geübt"></td>`;
          const pct = Math.round((100 * t.c) / t.n);
          const level = pct >= 80 ? 'hm-ok' : pct >= 50 ? 'hm-mid' : 'hm-bad';
          return `<td class="hm-cell ${level}" title="${esc(`${stringLetter(s, lang)}-Saite, ${f === 0 ? 'leer' : `${f}. Bund`}: ${t.c} von ${t.n} richtig`)}" aria-label="${pct} Prozent"></td>`;
        })
        .join('');
      return `<tr><th scope="row">${esc(stringLetter(s, lang))}</th>${cells}</tr>`;
    })
    .join('');
  return `<div class="heatmap-scroll" data-testid="heatmap">
      <table class="heatmap" aria-label="Griffbrett-Heatmap: Trefferquote je Stelle">
        <thead>${head}</thead><tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted small hm-legend"><span class="hm-swatch hm-bad"></span> unter 50 % <span class="hm-swatch hm-mid"></span> 50–79 % <span class="hm-swatch hm-ok"></span> ab 80 % richtig <span class="hm-swatch hm-none"></span> nicht geübt</p>`;
}
