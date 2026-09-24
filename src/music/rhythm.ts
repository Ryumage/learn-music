/** Notenwerte, wie sie unter dem Tab stehen (PLAN M7). Dauer in Schlägen (Viertel = 1). */
export type NoteValue = 'whole' | 'dhalf' | 'half' | 'dquarter' | 'quarter' | 'eighth' | 'sixteenth';

export const VALUES: readonly NoteValue[] = ['whole', 'dhalf', 'half', 'dquarter', 'quarter', 'eighth', 'sixteenth'];

export const BEATS: Record<NoteValue, number> = {
  whole: 4,
  dhalf: 3,
  half: 2,
  dquarter: 1.5,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
};

export const VALUE_NAMES: Record<NoteValue, string> = {
  whole: 'Ganze',
  dhalf: 'Punktierte Halbe',
  half: 'Halbe',
  dquarter: 'Punktierte Viertel',
  quarter: 'Viertel',
  eighth: 'Achtel',
  sixteenth: 'Sechzehntel',
};

/** Darstellung unter dem Tab, in Worten (für Lösung und Merkhilfe). */
export const VALUE_LOOK: Record<NoteValue, string> = {
  whole: 'eingekreiste Zahl, kein Hals',
  dhalf: 'eingekreiste Zahl, kurzer Hals, Punkt',
  half: 'eingekreiste Zahl, kurzer Hals',
  dquarter: 'langer Hals mit Punkt',
  quarter: 'langer Hals',
  eighth: 'Hals mit einem Fähnchen oder Balken',
  sixteenth: 'Hals mit zwei Fähnchen oder Balken',
};

/** Schläge als Text mit Bruchzeichen: 1.5 → „1½“, 0.25 → „¼“. */
export function beatsText(beats: number): string {
  const whole = Math.floor(beats);
  const frac = beats - whole;
  const f = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : '';
  return whole === 0 ? f || '0' : `${whole}${f}`;
}

export const BEAT_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3, 4] as const;

export function measureBeats(values: readonly NoteValue[]): number {
  return values.reduce((a, v) => a + BEATS[v], 0);
}

/** Einsatzzeiten (in Schlägen ab 0) jeder Note eines Takts. */
export function onsets(values: readonly NoteValue[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const v of values) {
    out.push(t);
    t += BEATS[v];
  }
  return out;
}

/** Zählzeit auf dem Achtelraster: 0 → „1“, 0.5 → „1 +“, 3.5 → „4 +“. */
export function countLabel(onset: number): string {
  const beat = Math.floor(onset) + 1;
  return onset % 1 === 0 ? String(beat) : `${beat} +`;
}

/** Alle Achtel-Zählzeiten eines 4/4-Takts: „1“, „1 +“ … „4 +“. */
export const COUNT_LABELS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map(countLabel);

/** Den ganzen Takt vorzählen, die Einsätze fett: „**1** + **2** **+** 3 + 4 +“ als Teile. */
export function countAlong(values: readonly NoteValue[]): { label: string; hit: boolean }[] {
  const starts = new Set(onsets(values));
  return [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t) => ({ label: t % 1 === 0 ? String(t + 1) : '+', hit: starts.has(t) }));
}

/** Bausteine für Zählzeit-Takte (PLAN M7): Viertel, Achtelpaar, Halbe, punktierte Viertel + Achtel. */
const COUNT_BLOCKS: readonly (readonly NoteValue[])[] = [['quarter'], ['eighth', 'eighth'], ['half'], ['dquarter', 'eighth']];

/** Zufälliger 4/4-Takt aus den Zählzeit-Bausteinen. */
export function countMeasure(rng: () => number): NoteValue[] {
  const out: NoteValue[] = [];
  let left = 4;
  while (left > 0) {
    const fits = COUNT_BLOCKS.filter((b) => measureBeats(b) <= left);
    const block = fits[Math.floor(rng() * fits.length)]!;
    out.push(...block);
    left -= measureBeats(block);
  }
  return out;
}

/** 4/4-Takt mit Einsatz genau auf `onset` (Achtelraster), aus den Zählzeit-Bausteinen. */
export function countMeasureWith(onset: number, rng: () => number): { values: NoteValue[]; index: number } {
  for (let i = 0; i < 200; i++) {
    const values = countMeasure(rng);
    const index = onsets(values).indexOf(onset);
    if (index >= 0) return { values, index };
  }
  // Rückfall: Achtel überall
  return { values: Array<NoteValue>(8).fill('eighth'), index: onset * 2 };
}

/**
 * „Takt ergänzen“: 4/4-Takt mit höchstens 8 Noten, der `missing` enthält.
 * Der fehlende Wert ist eindeutig, weil alle Werte verschiedene Dauern haben.
 */
export function fillMeasure(missing: NoteValue, rng: () => number): { values: NoteValue[]; index: number } {
  const pool: NoteValue[] = ['half', 'dquarter', 'quarter', 'quarter', 'eighth', 'eighth', 'sixteenth'];
  for (let i = 0; i < 500; i++) {
    const values: NoteValue[] = [missing];
    let left = 4 - BEATS[missing];
    while (left > 0 && values.length < 8) {
      const fits = pool.filter((v) => BEATS[v] <= left);
      const v = fits[Math.floor(rng() * fits.length)]!;
      values.push(v);
      left -= BEATS[v];
    }
    if (left !== 0) continue;
    // mischen, dann so ordnen, dass keine Note über eine Schlaggrenze ragt, wo es sich vermeiden lässt
    const shuffled = values.map((v) => [rng(), v] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    if (!alignedToBeats(shuffled)) continue;
    return { values: shuffled, index: shuffled.indexOf(missing) };
  }
  // Rückfall ohne Zufall
  const rest = 4 - BEATS[missing];
  const values: NoteValue[] = [missing];
  for (let t = 0; t < rest; t += 0.5) values.push('eighth');
  return { values, index: 0 };
}

/** Achtel und Sechzehntel dürfen keine Schlaggrenze überqueren (sonst gäbe es Überbindungen). */
export function alignedToBeats(values: readonly NoteValue[]): boolean {
  const starts = onsets(values);
  return values.every((v, i) => {
    const b = BEATS[v];
    const s = starts[i]!;
    if (b < 1) return Math.floor(s) === Math.floor(s + b - 0.0001);
    return s % 1 === 0;
  });
}

/** Balkengruppen: aufeinanderfolgende Achtel/Sechzehntel im selben Schlag. Rückgabe: Indizes je Gruppe. */
export function beamGroups(values: readonly NoteValue[]): number[][] {
  const starts = onsets(values);
  const groups: number[][] = [];
  let cur: number[] = [];
  let beat = -1;
  values.forEach((v, i) => {
    const short = v === 'eighth' || v === 'sixteenth';
    const b = Math.floor(starts[i]!);
    if (short && (cur.length === 0 || b === beat)) {
      cur.push(i);
      beat = b;
    } else {
      if (cur.length) groups.push(cur);
      cur = short ? [i] : [];
      beat = b;
    }
  });
  if (cur.length) groups.push(cur);
  return groups;
}

/** Schlagmuster im UG-Stil: 8 Achtel, D = ab, U = auf, . = Luftschlag. */
export const STRUM_PATTERNS: readonly { pattern: string; name?: string }[] = [
  { pattern: 'D.DU.UDU', name: 'Old Faithful' },
  { pattern: 'D.D.DUDU' },
  { pattern: 'DUDUDUDU' },
  { pattern: 'D.DUDUDU' },
  { pattern: 'D.D.D.DU' },
  { pattern: 'D.DU.U.U' },
];

/** Regel: ↓ auf den Zahlen, ↑ auf „und“. */
export function strumDirection(slot: number): 'D' | 'U' {
  return slot % 2 === 0 ? 'D' : 'U';
}

export function strumArrows(pattern: string): string {
  return [...pattern].map((c) => (c === 'D' ? '↓' : c === 'U' ? '↑' : '·')).join(' ');
}

/** Taktarten (PLAN M7). */
export const TIME_SIGNATURES = {
  '4/4': '4 Viertel pro Takt',
  '3/4': '3 Viertel pro Takt',
  '6/8': '6 Achtel pro Takt, gefühlt 2 × 3',
} as const;
export type TimeSig = keyof typeof TIME_SIGNATURES;

/** Sekunden als Text mit deutschem Dezimalkomma: 0.6 → „0,6 s“. */
export function secondsText(s: number): string {
  const r = Math.round(s * 1000) / 1000;
  return `${String(r).replace('.', ',')} s`;
}

/** Dauer eines Schlags (Viertel) in Sekunden: 60 / bpm. */
export function beatSeconds(bpm: number): number {
  return 60 / bpm;
}

/** Dauer eines 4/4-Takts in Sekunden: 240 / bpm. */
export function barSeconds(bpm: number): number {
  return 240 / bpm;
}

export const TEMPOS = [60, 80, 100, 120] as const;
