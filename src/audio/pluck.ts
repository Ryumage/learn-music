/**
 * Synthetisch gezupfte Saite (Karplus-Strong). Keine Samples, keine Downloads.
 * Gespielt wird immer die klingende Tonhöhe (Gitarre klingt eine Oktave tiefer als notiert).
 */

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Erzeugt die Samples einer gezupften Saite. */
export function karplusStrong(freq: number, sampleRate: number, seconds = 1.6, rng: () => number = Math.random): Float32Array {
  const n = Math.round(sampleRate * seconds);
  const period = Math.max(2, Math.round(sampleRate / freq));
  const out = new Float32Array(n);
  // Anschlag: gefiltertes Rauschen, etwas weicher als reines Rauschen
  let prev = 0;
  for (let i = 0; i < period; i++) {
    const noise = rng() * 2 - 1;
    prev = 0.6 * noise + 0.4 * prev;
    out[i] = prev;
  }
  // Tiefe Saiten klingen länger nach
  const decay = 0.996 - Math.min(0.006, freq / 250000);
  for (let i = period; i < n; i++) {
    out[i] = decay * 0.5 * (out[i - period]! + out[i - period - 1 >= 0 ? i - period - 1 : 0]!);
  }
  // sanftes Ausblenden am Ende gegen Knacken
  const fade = Math.min(n, Math.round(sampleRate * 0.05));
  for (let i = 0; i < fade; i++) out[n - 1 - i]! *= i / fade;
  return out;
}

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let enabled = true;
const cache = new Map<number, AudioBuffer>();

function context(): Ctx | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

/** Muss in einer Nutzeraktion aufgerufen werden (iOS startet Audio sonst nicht). */
export function unlockAudio(): void {
  if (!enabled) return;
  const c = context();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
}

function buffer(c: Ctx, midi: number): AudioBuffer {
  let b = cache.get(midi);
  if (!b) {
    const data = karplusStrong(midiToFreq(midi), c.sampleRate);
    b = c.createBuffer(1, data.length, c.sampleRate);
    b.getChannelData(0).set(data);
    cache.set(midi, b);
  }
  return b;
}

/** Spielt Töne (klingende MIDI-Werte); mehrere leicht „geschlagen“ mit 35 ms Versatz. */
export function play(midis: readonly number[], delay = 0, strum = 0.035): void {
  if (!enabled || midis.length === 0) return;
  const c = context();
  if (!c) return;
  unlockAudio();
  const gain = c.createGain();
  gain.gain.value = Math.min(0.6, 0.9 / Math.sqrt(midis.length));
  gain.connect(c.destination);
  const t0 = c.currentTime + 0.02 + delay;
  [...midis]
    .sort((a, b) => a - b)
    .forEach((m, i) => {
      const src = c.createBufferSource();
      src.buffer = buffer(c, m);
      src.connect(gain);
      src.start(t0 + i * strum);
    });
}

/** Spielt eine Folge von Klängen nacheinander (z. B. eine Notenzeile). */
export function playSequence(chords: readonly (readonly number[])[], gap = 0.5): void {
  chords.forEach((ch, i) => play(ch, i * gap));
}
