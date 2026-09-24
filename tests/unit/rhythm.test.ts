import { describe, expect, it } from 'vitest';
import {
  alignedToBeats,
  barSeconds,
  beamGroups,
  BEATS,
  beatSeconds,
  beatsText,
  COUNT_LABELS,
  countAlong,
  countLabel,
  countMeasure,
  countMeasureWith,
  fillMeasure,
  measureBeats,
  onsets,
  secondsText,
  STRUM_PATTERNS,
  strumDirection,
  VALUES,
} from '../../src/music/rhythm';

/** deterministischer Zufall */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Notenwerte (PLAN M7)', () => {
  it('Schläge je Wert', () => {
    expect(BEATS).toEqual({ whole: 4, dhalf: 3, half: 2, dquarter: 1.5, quarter: 1, eighth: 0.5, sixteenth: 0.25 });
    expect(VALUES).toHaveLength(7);
  });

  it('Schläge als Text mit Bruchzeichen', () => {
    expect([0.25, 0.5, 1, 1.5, 2, 3, 4].map(beatsText)).toEqual(['¼', '½', '1', '1½', '2', '3', '4']);
    expect(beatsText(2.75)).toBe('2¾');
  });
});

describe('Takte', () => {
  it('Zählzeit-Takte ergeben immer 4 Schläge und liegen auf dem Achtelraster', () => {
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      const m = countMeasure(rng);
      expect(measureBeats(m)).toBe(4);
      for (const t of onsets(m)) expect((t * 2) % 1).toBe(0);
      expect(m.every((v) => ['quarter', 'eighth', 'half', 'dquarter'].includes(v))).toBe(true);
    }
  });

  it('Zählzeit-Takt mit Einsatz an jeder Achtelstelle', () => {
    const rng = seeded(2);
    for (let slot = 0; slot < 8; slot++) {
      for (let i = 0; i < 20; i++) {
        const { values, index } = countMeasureWith(slot / 2, rng);
        expect(measureBeats(values)).toBe(4);
        expect(onsets(values)[index]).toBe(slot / 2);
      }
    }
  });

  it('Takt ergänzen: 4 Schläge, höchstens 8 Noten, gesuchter Wert an der Stelle, keine Überbindung', () => {
    const rng = seeded(3);
    for (const v of VALUES.filter((x) => x !== 'whole')) {
      for (let i = 0; i < 40; i++) {
        const { values, index } = fillMeasure(v, rng);
        expect(measureBeats(values)).toBe(4);
        expect(values.length).toBeLessThanOrEqual(8);
        expect(values[index]).toBe(v);
        expect(alignedToBeats(values)).toBe(true);
      }
    }
  });

  it('Zählzeiten: 1, 1 +, … 4 +', () => {
    expect(COUNT_LABELS).toEqual(['1', '1 +', '2', '2 +', '3', '3 +', '4', '4 +']);
    expect(countLabel(0)).toBe('1');
    expect(countLabel(1.5)).toBe('2 +');
    expect(countLabel(3.5)).toBe('4 +');
  });

  it('Takt vorzählen: Einsätze markiert', () => {
    // punktierte Viertel + Achtel, Viertel, Achtelpaar
    const m = ['dquarter', 'eighth', 'quarter', 'eighth', 'eighth'] as const;
    expect(measureBeats(m)).toBe(4);
    expect(onsets(m)).toEqual([0, 1.5, 2, 3, 3.5]);
    const row = countAlong(m);
    expect(row.map((c) => c.label).join(' ')).toBe('1 + 2 + 3 + 4 +');
    expect(row.map((c) => c.hit)).toEqual([true, false, false, true, true, false, true, true]);
  });

  it('Balkengruppen je Schlag', () => {
    expect(beamGroups(['eighth', 'eighth', 'quarter', 'sixteenth', 'sixteenth', 'eighth', 'half'])).toEqual([
      [0, 1],
      [3, 4, 5],
    ]);
    // Achtel über die Schlaggrenze werden getrennt
    expect(beamGroups(['dquarter', 'eighth', 'eighth', 'eighth'])).toEqual([[1], [2, 3]]);
  });
});

describe('Schlagmuster', () => {
  it('↓ auf den Zahlen, ↑ auf „und“ – in allen Mustern', () => {
    expect(STRUM_PATTERNS[0]).toEqual({ pattern: 'D.DU.UDU', name: 'Old Faithful' });
    for (const { pattern } of STRUM_PATTERNS) {
      expect(pattern).toHaveLength(8);
      [...pattern].forEach((c, i) => {
        if (c !== '.') expect(c).toBe(strumDirection(i));
      });
    }
  });

  it('jede Achtelstelle kommt in einem Muster vor', () => {
    for (let slot = 0; slot < 8; slot++) expect(STRUM_PATTERNS.some((p) => p.pattern[slot] !== '.')).toBe(true);
  });
});

describe('Tempo', () => {
  it('♩ = 100 → 0,6 s pro Schlag, 2,4 s pro Takt', () => {
    expect(secondsText(beatSeconds(100))).toBe('0,6 s');
    expect(secondsText(barSeconds(100))).toBe('2,4 s');
  });

  it('60/80/120', () => {
    expect(secondsText(beatSeconds(60))).toBe('1 s');
    expect(secondsText(beatSeconds(80))).toBe('0,75 s');
    expect(secondsText(barSeconds(80))).toBe('3 s');
    expect(secondsText(barSeconds(120))).toBe('2 s');
  });
});
