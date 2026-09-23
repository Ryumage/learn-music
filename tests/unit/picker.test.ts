import { describe, expect, it } from 'vitest';
import { grade } from '../../src/learn/leitner';
import { pickWeighted, shuffle, weight } from '../../src/learn/picker';

const NOW = new Date(2026, 0, 10, 12).getTime();

/** kleiner deterministischer Zufallsgenerator */
function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('Gewichtung (PLAN 5.4)', () => {
  it('neu = 1,3', () => {
    expect(weight(undefined, NOW, false)).toBeCloseTo(1.3);
  });

  it('fällig, Fehlerquote und langsam addieren sich', () => {
    const wrong = grade(undefined, false, 8000, NOW - 1000);
    // fällig 3 + Fehlerquote 3·1,5/2 = 2,25 + langsam 0,6
    expect(weight(wrong, NOW, false)).toBeCloseTo(3 + 2.25 + 0.6);
  });

  it('nicht fällig = 0,5 + Fehlerquote', () => {
    const ok = grade(undefined, true, 1000, NOW - 1000);
    expect(weight(ok, NOW, false)).toBeCloseTo(0.5 + (3 * 0.5) / 2);
  });

  it('unter den letzten 2 Elementen × 0,03', () => {
    expect(weight(undefined, NOW, true)).toBeCloseTo(1.3 * 0.03);
  });

  it('keine direkte Wiederholung', () => {
    const r = rng(7);
    const keys = ['a', 'b', 'c', 'd'];
    const recent: string[] = [];
    let repeats = 0;
    for (let i = 0; i < 2000; i++) {
      const k = pickWeighted(keys, {}, NOW, recent, r);
      if (k === recent[recent.length - 1]) repeats++;
      recent.push(k);
    }
    expect(repeats / 2000).toBeLessThan(0.03);
  });

  it('fällige und fehlerhafte Elemente kommen öfter', () => {
    const r = rng(3);
    const stats = { hard: grade(undefined, false, 1000, NOW - 1000), easy: grade(undefined, true, 1000, NOW - 1000) };
    let hard = 0;
    for (let i = 0; i < 1000; i++) if (pickWeighted(['hard', 'easy'], stats, NOW, [], r) === 'hard') hard++;
    expect(hard).toBeGreaterThan(700);
  });

  it('mischt ohne Elemente zu verlieren', () => {
    expect(shuffle([1, 2, 3, 4, 5], rng(2)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
