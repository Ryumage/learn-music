import { describe, expect, it } from 'vitest';
import { dueDate, grade, isDue, startOfDay } from '../../src/learn/leitner';

const at = (d: number, h = 15, m = 0) => new Date(2026, 0, d, h, m).getTime();

describe('Leitner (PLAN 5.3)', () => {
  it('Stichtag ist Tagesbeginn + Tage + 3 h', () => {
    expect(startOfDay(at(10))).toBe(new Date(2026, 0, 10).getTime());
    expect(dueDate(at(10), 1)).toBe(at(11, 3));
    expect(dueDate(at(31), 3)).toBe(new Date(2026, 1, 3, 3).getTime());
  });

  it('richtig und neu: Box 1, morgen früh fällig', () => {
    const s = grade(undefined, true, 2500, at(10));
    expect(s).toMatchObject({ n: 1, c: 1, w: 0, box: 1, due: at(11, 3), t: 2500, last: at(10) });
  });

  it('richtig und fällig: Box steigt, Abstände 1, 3, 7, 14, 30 Tage', () => {
    let s = grade(undefined, true, 1000, at(1));
    const expected = [
      [2, 3],
      [3, 7],
      [4, 14],
      [5, 30],
      [5, 30],
    ];
    let day = 1;
    for (const [box, days] of expected) {
      day += 40; // sicher fällig
      const now = new Date(2026, 0, day, 12).getTime();
      s = grade(s, true, 1000, now);
      expect(s.box).toBe(box);
      expect(s.due).toBe(dueDate(now, days!));
    }
  });

  it('richtig, aber nicht fällig: keine Änderung an Box und Fälligkeit', () => {
    const first = grade(undefined, true, 1000, at(10, 9));
    const again = grade(first, true, 1000, at(10, 18));
    expect(again.box).toBe(first.box);
    expect(again.due).toBe(first.due);
    expect(again.n).toBe(2);
    expect(again.c).toBe(2);
  });

  it('falsch: Box 0, sofort fällig', () => {
    let s = grade(undefined, true, 1000, at(1));
    s = grade(s, true, 1000, at(5));
    s = grade(s, false, 9000, at(20));
    expect(s).toMatchObject({ box: 0, due: at(20), w: 1, n: 3, t: 9000 });
    expect(isDue(s, at(20))).toBe(true);
  });

  it('Fälligkeit', () => {
    const s = grade(undefined, true, 1000, at(10));
    expect(isDue(s, at(11, 2, 59))).toBe(false);
    expect(isDue(s, at(11, 3))).toBe(true);
    expect(isDue(undefined, at(10))).toBe(true);
  });
});
