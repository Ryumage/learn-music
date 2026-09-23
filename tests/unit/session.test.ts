import { describe, expect, it } from 'vitest';
import { Session } from '../../src/learn/session';
import { Store } from '../../src/learn/store';
import type { ModuleDef, Question } from '../../src/modules/types';

/** Testmodul: Element „k:X“ fragt nach dem Ton X (0–6), zwei Felder bei „k:multi“. */
function testModule(): ModuleDef {
  let n = 0;
  return {
    id: 'test',
    name: 'Test',
    desc: '',
    prefixes: ['k:'],
    settings: [],
    count: () => 6,
    keys: () => ['k:0', 'k:1', 'k:2'],
    make(_s, ctx): Question {
      const key = ctx.forced ?? `k:${n++ % 7}`;
      if (key === 'k:multi') {
        return {
          kind: 'notes',
          prompt: 'zwei',
          items: [key],
          fieldItems: ['k:m1', 'k:m2'],
          fields: [{ answer: { letter: 0, acc: 0 } }, { answer: { letter: 2, acc: 0 } }],
          compare: 'exact',
          accidentals: false,
          explain: '',
          solution: 'C E',
        };
      }
      const letter = Number(key.split(':')[1]);
      return {
        kind: 'notes',
        prompt: key,
        items: [key],
        fields: [{ answer: { letter, acc: 0 } }],
        compare: 'pc',
        accidentals: false,
        explain: '',
        solution: String(letter),
      };
    },
    label: (k) => k,
  };
}

function setup(forced?: string[]) {
  let now = new Date(2026, 0, 10, 12).getTime();
  const store = new Store(null, () => (now += 1000));
  const s = new Session(testModule(), {}, store, { lang: 'de', forced });
  return { s, store };
}

function answerCurrent(s: Session, correct: boolean) {
  const q = s.current!.question;
  if (q.kind !== 'notes') throw new Error();
  s.current!.answer = q.fields.map((f) => ({ letter: correct ? f.answer.letter : (f.answer.letter + 1) % 7, acc: 0 }));
  return s.check();
}

describe('Sitzung (PLAN 5.1/5.2)', () => {
  it('Prüfen erst bei vollständiger Antwort', () => {
    const { s } = setup();
    s.next();
    expect(s.check()).toBe('answering');
    expect(s.current!.attempt).toBe(0);
  });

  it('richtig → correct, gespeichert als richtig', () => {
    const { s, store } = setup();
    s.next();
    expect(answerCurrent(s, true)).toBe('correct');
    expect(store.stat('k:0')).toMatchObject({ n: 1, c: 1, box: 1 });
  });

  it('falsch → Nochmal genau einmal, dann Lösung; nur der erste Versuch zählt', () => {
    const { s, store } = setup();
    s.next();
    expect(answerCurrent(s, false)).toBe('wrong');
    s.retry();
    expect(s.current!.phase).toBe('answering');
    expect(answerCurrent(s, false)).toBe('revealed');
    expect(store.stat('k:0')).toMatchObject({ n: 1, w: 1, box: 0 });
    expect(s.results[0]).toMatchObject({ firstCorrect: false });
  });

  it('richtig im zweiten Versuch zählt trotzdem als Fehler', () => {
    const { s, store } = setup();
    s.next();
    answerCurrent(s, false);
    s.retry();
    expect(answerCurrent(s, true)).toBe('correct');
    expect(store.stat('k:0')!.c).toBe(0);
    expect(s.results[0]!.firstCorrect).toBe(false);
  });

  it('Lösung zeigen ohne Versuch wertet als falsch', () => {
    const { s, store } = setup();
    s.next();
    s.reveal();
    expect(s.current!.phase).toBe('revealed');
    expect(store.stat('k:0')!.w).toBe(1);
  });

  it('Nochmal: richtige Teile bleiben gesperrt, falsche werden geleert', () => {
    const { s } = setup(['k:multi']);
    s.next();
    s.current!.answer = [{ letter: 0, acc: 0 }, { letter: 3, acc: 0 }];
    expect(s.check()).toBe('wrong');
    expect(s.current!.parts).toEqual([true, false]);
    s.retry();
    expect(s.current!.answer).toEqual([{ letter: 0, acc: 0 }, null]);
    expect(s.current!.locked).toEqual([true, false]);
  });

  it('Mehrfach-Antworten werden je Feld als eigenes Element gespeichert', () => {
    const { s, store } = setup(['k:multi']);
    s.next();
    s.current!.answer = [{ letter: 0, acc: 0 }, { letter: 3, acc: 0 }];
    s.check();
    expect(store.stat('k:m1')!.c).toBe(1);
    expect(store.stat('k:m2')!.w).toBe(1);
    expect(store.stat('k:multi')).toBeUndefined();
  });

  it('Fehlerschleife: Fehler kommt einmal etwa 4 Fragen später wieder und zählt nicht zur Runde', () => {
    const { s } = setup();
    const log: string[] = [];
    let i = 0;
    while (s.next()) {
      const c = s.current!;
      log.push(`${c.isRetry ? 'R' : ''}${c.question.items[0]}`);
      answerCurrent(s, !(i === 1 && !c.isRetry)); // 2. Frage falsch
      if (c.phase === 'wrong') s.reveal();
      i++;
    }
    expect(log).toEqual(['k:0', 'k:1', 'k:2', 'k:3', 'k:4', 'Rk:1', 'k:5']);
    expect(s.results.filter((r) => !r.isRetry)).toHaveLength(6);
    expect(s.results.filter((r) => r.isRetry)).toHaveLength(1);
    expect(s.done).toBe(true);
  });

  it('offene Wiederholungen kommen vor dem Ende der Runde', () => {
    const { s } = setup();
    const log: string[] = [];
    let i = 0;
    while (s.next()) {
      const c = s.current!;
      log.push(`${c.isRetry ? 'R' : ''}${c.question.items[0]}`);
      answerCurrent(s, !(i === 5 && !c.isRetry)); // letzte Frage falsch
      if (c.phase === 'wrong') s.reveal();
      i++;
    }
    expect(log[log.length - 1]).toBe('Rk:5');
  });

  it('erzwungene Elemente bestimmen die Runde („Fehler üben“)', () => {
    const { s } = setup(['k:3', 'k:5']);
    expect(s.total).toBe(2);
    s.next();
    expect(s.current!.question.items).toEqual(['k:3']);
  });
});
