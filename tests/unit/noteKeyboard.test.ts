import { describe, expect, it } from 'vitest';
import { createInput, pressAccidental, pressBackspace, pressLetter, selectField } from '../../src/input/noteKeyboard';

const empty = (n: number) => createInput(Array(n).fill(null), Array(n).fill(false));

describe('Notentastatur (PLAN 7.2)', () => {
  it('nach jeder Note springt der Cursor zum nächsten leeren Feld', () => {
    let s = empty(3);
    s = pressLetter(s, 0);
    expect(s.active).toBe(1);
    s = pressLetter(s, 2);
    expect(s.active).toBe(2);
    s = pressLetter(s, 4);
    expect(s.answer).toEqual([
      { letter: 0, acc: 0 },
      { letter: 2, acc: 0 },
      { letter: 4, acc: 0 },
    ]);
    expect(s.active).toBe(2);
  });

  it('♯/♭ ändern die zuletzt eingegebene Note und schalten beim zweiten Druck zurück', () => {
    let s = pressLetter(empty(2), 6);
    s = pressAccidental(s, -1);
    expect(s.answer[0]).toEqual({ letter: 6, acc: -1 });
    s = pressAccidental(s, 1);
    expect(s.answer[0]).toEqual({ letter: 6, acc: 1 });
    s = pressAccidental(s, 1);
    expect(s.answer[0]).toEqual({ letter: 6, acc: 0 });
  });

  it('♯ ohne vorherige Note tut nichts', () => {
    const s = empty(1);
    expect(pressAccidental(s, 1)).toBe(s);
  });

  it('⌫ leert das aktive Feld oder das vorherige', () => {
    let s = pressLetter(pressLetter(empty(3), 0), 1);
    expect(s.active).toBe(2);
    s = pressBackspace(s);
    expect(s.answer[1]).toBeNull();
    expect(s.active).toBe(1);
    s = pressBackspace(s);
    expect(s.answer[0]).toBeNull();
    expect(pressBackspace(s)).toBe(s);
  });

  it('gesperrte Felder bleiben unverändert', () => {
    let s = createInput([{ letter: 0, acc: 0 }, null], [true, false]);
    expect(s.active).toBe(1);
    s = selectField(s, 0);
    expect(s.active).toBe(1);
    s = pressLetter(s, 3);
    s = pressBackspace(s);
    s = pressBackspace(s);
    expect(s.answer[0]).toEqual({ letter: 0, acc: 0 });
  });

  it('Tippen auf ein Feld wählt es aus, auch zum Überschreiben', () => {
    let s = pressLetter(pressLetter(empty(2), 0), 1);
    s = selectField(s, 0);
    s = pressLetter(s, 5);
    expect(s.answer[0]).toEqual({ letter: 5, acc: 0 });
  });
});
