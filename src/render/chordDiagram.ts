import { STRINGS, type StringNo } from '../music/guitar';
import { esc } from '../util/html';

export interface ChordDiagramOptions {
  highlight?: StringNo;
  label: string;
  frets?: number;
}

/** Leeres Akkorddiagramm, senkrecht, tiefe E-Saite links. */
export function renderChordDiagram({ highlight, label, frets = 5 }: ChordDiagramOptions): string {
  const gap = 28;
  const fretH = 34;
  const left = 22;
  const top = 26;
  const width = left * 2 + gap * 5;
  const height = top + fretH * frets + 14;
  const p: string[] = [];
  p.push(`<rect class="cd-nut" x="${left - 1}" y="${top - 5}" width="${gap * 5 + 2}" height="6" rx="1"/>`);
  for (let f = 1; f <= frets; f++) {
    p.push(`<line class="cd-fret" x1="${left}" x2="${left + gap * 5}" y1="${top + f * fretH}" y2="${top + f * fretH}"/>`);
  }
  STRINGS.forEach((s, i) => {
    const x = left + i * gap;
    const hl = highlight === s;
    p.push(`<line class="cd-string${hl ? ' cd-hl' : ''}" x1="${x}" x2="${x}" y1="${top}" y2="${top + frets * fretH}" stroke-width="${hl ? 4 : 1.5}"/>`);
    if (hl) p.push(`<path class="cd-arrow" d="M${x - 7} ${top - 20}L${x + 7} ${top - 20}L${x} ${top - 9}Z"/>`);
  });
  return `<svg class="chord-diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${p.join('')}</svg>`;
}

export interface ChordShapeOptions {
  /** Griff von der tiefen E- zur hohen e-Saite, null = nicht gespielt */
  shape: (number | null)[];
  /** Fingersatz wie „x32010“ (Ziffern in den Punkten) */
  fingers?: string | null;
  /** Editierbar: Zellen und Leersaiten-Zeile antippbar */
  editable?: boolean;
  /** Farbe je Saite nach dem Prüfen */
  states?: ('ok' | 'bad' | null)[];
  /** Tonnamen unter jeder Saite */
  names?: (string | null)[];
  frets?: number;
  label: string;
}

/**
 * Akkorddiagramm: senkrecht, tiefe E-Saite links, × und ○ über dem Sattel,
 * Fingernummern in den Punkten, Barré als Balken, „3fr“ bei höheren Lagen.
 */
export function renderChordShape({ shape, fingers, editable = false, states, names, frets = 5, label }: ChordShapeOptions): string {
  const gap = 36;
  const fretH = 42;
  const left = 26;
  const top = 46;
  const nameH = names ? 26 : 0;
  const width = left * 2 + gap * 5;
  const height = top + fretH * frets + 12 + nameH;
  const fretted = shape.filter((f): f is number => f !== null && f > 0);
  const base = fretted.length && Math.max(...fretted) > frets ? Math.min(...fretted) : 1;
  const p: string[] = [];
  const x = (i: number) => left + i * gap;
  const yFret = (f: number) => top + (f - base + 0.5) * fretH;

  if (base === 1) p.push(`<rect class="cd-nut" x="${left - 1}" y="${top - 6}" width="${gap * 5 + 2}" height="7" rx="1"/>`);
  else p.push(`<text class="cd-fr" x="${left - 8}" y="${top + fretH * 0.62}" text-anchor="end">${base}fr</text>`);
  for (let f = 0; f <= frets; f++) {
    p.push(`<line class="cd-fret" x1="${left}" x2="${left + gap * 5}" y1="${top + f * fretH}" y2="${top + f * fretH}"/>`);
  }
  shape.forEach((_, i) => {
    const st = states?.[i];
    p.push(`<line class="cd-string${st ? ` cd-${st}` : ''}" x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${top + frets * fretH}" stroke-width="${1.2 + (5 - i) * 0.3}"/>`);
  });

  // Barré: Finger 1 auf mehreren Saiten im selben Bund
  if (fingers) {
    const ones = [...fingers].map((ch, i) => (ch === '1' ? i : -1)).filter((i) => i >= 0);
    const barFret = ones.length > 1 ? shape[ones[0]!] : null;
    if (barFret && ones.every((i) => shape[i] === barFret)) {
      const a = Math.min(...ones);
      const b = Math.max(...ones);
      p.push(`<rect class="cd-barre" x="${x(a) - 12}" y="${yFret(barFret) - 12}" width="${x(b) - x(a) + 24}" height="24" rx="12"/>`);
    }
  }

  shape.forEach((f, i) => {
    const cx = x(i);
    const st = states?.[i];
    const cls = st ? ` cd-${st}` : '';
    if (f === null) p.push(`<text class="cd-mute${cls}" x="${cx}" y="${top - 16}" text-anchor="middle">×</text>`);
    else if (f === 0) p.push(`<circle class="cd-open${cls}" cx="${cx}" cy="${top - 22}" r="8"/>`);
    else {
      const finger = fingers?.[i];
      p.push(
        `<g class="cd-dot${cls}"><circle cx="${cx}" cy="${yFret(f)}" r="13"/>${finger && /[1-4]/.test(finger) ? `<text x="${cx}" y="${yFret(f) + 5}" text-anchor="middle">${finger}</text>` : ''}</g>`,
      );
    }
    if (names) {
      const n = names[i];
      p.push(`<text class="cd-name${cls}" x="${cx}" y="${top + frets * fretH + 30}" text-anchor="middle">${esc(n ?? '')}</text>`);
    }
  });

  if (editable) {
    shape.forEach((_, i) => {
      p.push(
        `<rect class="cd-hit" x="${x(i) - gap / 2}" y="0" width="${gap}" height="${top - 4}" data-action="cd-open" data-index="${i}" role="button" aria-label="${i + 1}. Linie von links: leer oder nicht spielen"/>`,
      );
      for (let f = base; f < base + frets; f++) {
        p.push(
          `<rect class="cd-hit" x="${x(i) - gap / 2}" y="${top + (f - base) * fretH}" width="${gap}" height="${fretH}" data-action="cd-cell" data-index="${i}" data-fret="${f}" role="button" aria-label="${i + 1}. Linie von links, ${f}. Bund"/>`,
        );
      }
    });
  }
  return `<svg class="chord-diagram${editable ? ' is-editable' : ''}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${p.join('')}</svg>`;
}
