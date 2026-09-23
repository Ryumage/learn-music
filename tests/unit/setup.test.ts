import { describe, expect, it } from 'vitest';
import { toggleSetting } from '../../src/screens/setup';
import type { SettingDef } from '../../src/modules/types';

const multi: SettingDef = {
  id: 'kinds',
  label: 'Aufgaben',
  type: 'multi',
  options: [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ],
  default: ['a', 'b'],
};

describe('Einstellungs-Chips', () => {
  it('Mehrfachauswahl behält die Reihenfolge und mindestens eine Option', () => {
    let s = toggleSetting(multi, { kinds: ['a', 'b'] }, 'a');
    expect(s.kinds).toEqual(['b']);
    s = toggleSetting(multi, s, 'b');
    expect(s.kinds).toEqual(['b']);
    s = toggleSetting(multi, s, 'a');
    expect(s.kinds).toEqual(['a', 'b']);
  });

  it('Auswahl und Schalter', () => {
    const choice: SettingDef = { id: 'count', label: '', type: 'choice', default: '20' };
    expect(toggleSetting(choice, { count: '20' }, '10').count).toBe('10');
    const toggle: SettingDef = { id: 'on', label: '', type: 'toggle', default: true };
    expect(toggleSetting(toggle, { on: true }).on).toBe(false);
  });
});
