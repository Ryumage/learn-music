import { describe, expect, it } from 'vitest';
import { ChangeCounter, ChangeDetector, chordScore, chordTemplate, chroma, fft } from '../../src/audio/changeDetector';
import { karplusStrong, midiToFreq } from '../../src/audio/pluck';
import { CHORDS } from '../../src/music/chordLibrary';
import { parseShape, shapeMidi } from '../../src/music/chords';
import { CHANGE_CHORDS } from '../../src/screens/changes';

const SR = 48000;

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const midisOf = (id: string) => shapeMidi(parseShape(CHORDS.find((c) => c.id === id)!.shape));

/**
 * Synthetische Übung: je Eintrag ein Abschlag (Saiten 15 ms versetzt), dazwischen wird abgedämpft
 * (wie beim Umgreifen), dazu leises Rauschen.
 */
function performance(ids: string[], opts: { gap?: number; seed?: number; noise?: number; level?: number } = {}): Float32Array {
  const gap = opts.gap ?? 1.4;
  const rng = seeded(opts.seed ?? 1);
  const out = new Float32Array(Math.round(SR * (ids.length * gap + 1)));
  ids.forEach((id, n) => {
    const start = Math.round(SR * (0.5 + n * gap));
    // vor dem Anschlag abdämpfen
    const mute = Math.round(SR * 0.08);
    for (let i = start - mute; i < start; i++) if (i >= 0) out[i]! *= (start - i) / mute;
    for (let i = start; i < out.length; i++) out[i] = 0;
    midisOf(id).forEach((m, k) => {
      const s = karplusStrong(midiToFreq(m), SR, gap + 0.5, rng);
      const off = start + Math.round(SR * 0.015 * k);
      for (let i = 0; i < s.length && off + i < out.length; i++) out[off + i]! += (opts.level ?? 0.25) * s[i]!;
    });
  });
  const noise = opts.noise ?? 0.0008;
  for (let i = 0; i < out.length; i++) out[i]! += noise * (rng() * 2 - 1);
  return out;
}

function run(a: string, b: string, signal: Float32Array, block = 2048): ChangeDetector {
  const d = new ChangeDetector(SR, [chordTemplate(midisOf(a)), chordTemplate(midisOf(b))]);
  for (let i = 0; i < signal.length; i += block) d.feed(signal.subarray(i, i + block));
  return d;
}

describe('FFT und Tonklassen-Profil', () => {
  it('FFT findet eine Sinusfrequenz', () => {
    const n = 1024;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 64 * i) / n);
    fft(re, im);
    const mags = Array.from(re, (r, k) => Math.hypot(r, im[k]!)).slice(0, n / 2);
    expect(mags.indexOf(Math.max(...mags))).toBe(64);
  });

  it('Sinus 440 Hz landet bei A, 261,6 Hz bei C', () => {
    const tone = (f: number) => Float32Array.from({ length: 8192 }, (_, i) => Math.sin((2 * Math.PI * f * i) / SR));
    const argmax = (v: number[]) => v.indexOf(Math.max(...v));
    expect(argmax(chroma(tone(440), SR))).toBe(9);
    expect(argmax(chroma(tone(261.63), SR))).toBe(0);
  });

  it('Vorlage mit Obertönen: Grundtöne des Griffs wiegen am meisten', () => {
    const t = chordTemplate(midisOf('C'));
    const top3 = t
      .map((v, pc) => [v, pc] as const)
      .sort((x, y) => y[0] - x[0])
      .slice(0, 3)
      .map((x) => x[1])
      .sort((x, y) => x - y);
    expect(top3).toEqual([0, 4, 7]);
  });

  it('Wert: A-Dur-Klang liegt näher an A als an D', () => {
    const rng = seeded(3);
    const sig = new Float32Array(8192);
    for (const m of midisOf('A')) {
      const s = karplusStrong(midiToFreq(m), SR, 0.5, rng);
      for (let i = 0; i < sig.length; i++) sig[i]! += s[i + 2000]!;
    }
    const templates: [number[], number[]] = [chordTemplate(midisOf('A')), chordTemplate(midisOf('D'))];
    expect(chordScore(chroma(sig, SR), templates)).toBeGreaterThan(0);
  });
});

describe('Wechsel-Zähler (zwei lernende Gruppen)', () => {
  it('abwechselnde Werte mit gemeinsamer Verschiebung zählen richtig', () => {
    // beide Akkorde „klingen“ negativ, aber klar getrennt
    const c = new ChangeCounter(0.2);
    for (const s of [-0.05, -0.16, -0.06, -0.12, -0.04, -0.14, -0.03, -0.15]) c.push(s);
    expect(c.changes).toBe(7);
  });

  it('Wiederholungen zählen nicht; Startakkord egal', () => {
    const a = 0.1;
    const b = -0.1;
    const c1 = new ChangeCounter(0.2);
    for (const s of [a, a, b, b, a]) c1.push(s);
    expect(c1.changes).toBe(2);
    const c2 = new ChangeCounter(0.2);
    for (const s of [b, a, b, a]) c2.push(s);
    expect(c2.changes).toBe(3);
  });
});

describe('Akkordwechsel zählen', () => {
  const pairs: [string, string][] = [
    ['A', 'D'],
    ['C', 'G'],
    ['E', 'Am'],
    ['D', 'Em'],
    ['G', 'D'],
    ['Am', 'C'],
    ['E', 'Em'],
    ['C', 'Fs'],
  ];

  for (const [a, b] of pairs) {
    it(`${a} ↔ ${b}: 10 Anschläge im Wechsel = 9 Wechsel`, () => {
      const ids = Array.from({ length: 10 }, (_, i) => (i % 2 ? b : a));
      const d = run(a, b, performance(ids));
      expect(d.strums).toBe(10);
      expect(d.changes).toBe(9);
    });
  }

  it('gleicher Akkord mehrfach angeschlagen zählt nicht als Wechsel', () => {
    const d = run('A', 'D', performance(['A', 'A', 'A', 'D', 'D', 'A']));
    expect(d.strums).toBe(6);
    expect(d.changes).toBe(2);
  });

  it('schnelles Tempo (0,7 s pro Akkord) und leises Spiel', () => {
    const ids = Array.from({ length: 12 }, (_, i) => (i % 2 ? 'G' : 'C'));
    const d = run('C', 'G', performance(ids, { gap: 0.7, level: 0.05, seed: 9 }));
    expect(d.strums).toBe(12);
    expect(d.changes).toBe(11);
  });

  it('Blockgröße des Mikrofons spielt keine Rolle', () => {
    const sig = performance(['A', 'D', 'A', 'D']);
    for (const block of [128, 1024, 4096]) expect(run('A', 'D', sig, block).changes).toBe(3);
  });

  it('Stille und gleichmäßiges Rauschen ergeben keine Anschläge', () => {
    const rng = seeded(5);
    const silence = new Float32Array(SR * 5);
    expect(run('A', 'D', silence).strums).toBe(0);
    const hiss = Float32Array.from({ length: SR * 5 }, () => 0.02 * (rng() * 2 - 1));
    expect(run('A', 'D', hiss).strums).toBe(0);
  });

  it('arm(): Anschläge vor dem Start (Einzählen) zählen nicht', () => {
    const sig = performance(['A', 'D', 'A', 'D', 'A']);
    const d = new ChangeDetector(SR, [chordTemplate(midisOf('A')), chordTemplate(midisOf('D'))]);
    const split = Math.round(SR * (0.5 + 1.4 * 2 - 0.2));
    d.feed(sig.subarray(0, split));
    expect(d.strums).toBe(2);
    d.arm();
    d.feed(sig.subarray(split));
    expect(d.strums).toBe(3);
    expect(d.changes).toBe(2);
  });
});

describe('alle Paare des Trainers', () => {
  it('abwechselnd angeschlagen: fast immer exakt, höchstens selten ±1', () => {
    const ids = CHANGE_CHORDS.map((c) => c.id);
    let exact = 0;
    let off = 0;
    let n = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i]!, ids[j]!];
        // mit Akkord 2 beginnen: die Reihenfolge darf keine Rolle spielen
        const seq = Array.from({ length: 8 }, (_, k) => (k % 2 ? a : b));
        const d = run(a, b, performance(seq, { gap: 1.1, seed: i * 31 + j }));
        n++;
        if (d.strums === 8 && d.changes === 7) exact++;
        else off += Math.abs(7 - d.changes);
      }
    }
    expect(exact / n).toBeGreaterThan(0.93);
    expect(off / n).toBeLessThan(0.15);
  }, 60_000);
});
