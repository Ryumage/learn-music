import { describe, expect, it } from 'vitest';
import { countInSeconds, newChangesState, pressKey, renderChanges } from '../../src/screens/changes';

describe('Akkordwechsel-Trainer', () => {
  it('Ziffernblock: anhängen, löschen, höchstens 3 Stellen, führende Null ersetzen', () => {
    expect(pressKey('', false, '2')).toBe('2');
    expect(pressKey('2', false, '7')).toBe('27');
    expect(pressKey('27', false, 'del')).toBe('2');
    expect(pressKey('', false, 'del')).toBe('');
    expect(pressKey('123', false, '4')).toBe('123');
    expect(pressKey('0', false, '5')).toBe('5');
  });

  it('vorbelegter Wert (Mikrofon): erste Ziffer ersetzt, Löschen leert', () => {
    expect(pressKey('23', true, '2')).toBe('2');
    expect(pressKey('23', true, 'del')).toBe('');
  });

  it('Einzählen: 5 … 1', () => {
    expect(countInSeconds(5000, 0)).toBe(5);
    expect(countInSeconds(5000, 100)).toBe(5);
    expect(countInSeconds(5000, 1000)).toBe(4);
    expect(countInSeconds(5000, 4999)).toBe(1);
  });

  it('gespeicherte Auswahl inkl. Zählart', () => {
    expect(newChangesState({})).toMatchObject({ a: 'A', b: 'D', mode: 'self', phase: 'setup' });
    expect(newChangesState({ a: 'C', b: 'G', mode: 'mic' })).toMatchObject({ a: 'C', b: 'G', mode: 'mic' });
  });

  it('kein Tipp-Zähler mehr; Mikrofon-Ergebnis wird zum Korrigieren angeboten', () => {
    const view = { best: 0, now: 0, lang: 'de' as const, sound: true };
    const st = newChangesState({});
    st.phase = 'running';
    st.endsAt = 60_000;
    const running = renderChanges(st, view);
    expect(running).not.toContain('changes-tap');
    expect(running).toContain('1:00');
    expect(running).toContain('Zähl im Kopf mit');
    st.phase = 'enter';
    st.detected = { changes: 23, strums: 25 };
    st.entry = '23';
    expect(renderChanges(st, view)).toContain('Das Mikrofon hat <b>23</b> Wechsel erkannt (25 Anschläge)');
  });
});
