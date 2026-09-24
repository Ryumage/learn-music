import { describe, expect, it } from 'vitest';
import { karplusStrong, midiToFreq } from '../../src/audio/pluck';

const rms = (a: Float32Array, from: number, to: number) => {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i]! ** 2;
  return Math.sqrt(s / (to - from));
};

describe('Klang (Karplus-Strong)', () => {
  it('Frequenzen', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(40)).toBeCloseTo(82.41, 1); // tiefe E-Saite klingend
  });

  it('klingt ab und bleibt im Wertebereich', () => {
    const sr = 44100;
    const data = karplusStrong(midiToFreq(64), sr, 1.2, () => 0.3);
    expect(data.length).toBe(Math.round(sr * 1.2));
    expect(rms(data, sr, sr + 2000)).toBeLessThan(rms(data, 0, 2000));
    expect(Math.max(...data.map(Math.abs))).toBeLessThanOrEqual(1);
  });

  it('ist periodisch mit der Grundfrequenz', () => {
    const sr = 44100;
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const data = karplusStrong(220, sr, 0.5, rng);
    const period = Math.round(sr / 220);
    const start = 5000;
    let same = 0;
    let other = 0;
    for (let i = start; i < start + 1000; i++) {
      same += Math.abs(data[i]! - data[i + period]!);
      other += Math.abs(data[i]! - data[i + Math.round(period / 2)]!);
    }
    expect(same).toBeLessThan(other);
  });
});
