/**
 * Akkordwechsel per Mikrofon zählen (optional, Beta).
 *
 * Reine Signalverarbeitung ohne Browser-APIs, damit sie mit synthetischen Anschlägen testbar ist:
 * 1. Anschläge finden: Die Lautstärke (RMS je Block) springt deutlich über den Pegel der letzten ~60 ms
 *    und über das Grundrauschen.
 * 2. Kurz nach jedem Anschlag das Tonklassen-Profil (Chroma) berechnen und mit den Tönen der beiden
 *    gewählten Griffe vergleichen: Wert = Ähnlichkeit zu Akkord 1 minus Ähnlichkeit zu Akkord 2.
 * 3. Die Werte bilden zwei Gruppen (eine je Akkord). Die Lage der Gruppen lernt der Zähler aus den
 *    Anschlägen selbst, weil Gitarre, Raum und Mikrofon den Klang verschieben. Ein Wechsel zählt,
 *    wenn ein Anschlag in der anderen Gruppe landet als der vorige – egal, mit welchem Akkord man beginnt.
 */

/** Analysefenster in Samples (bei 48 kHz ≈ 170 ms) */
export const WINDOW = 8192;
/** Blockgröße für die Lautstärke (bei 48 kHz ≈ 11 ms) */
const HOP = 512;
/** Mindestabstand zweier Anschläge in Sekunden */
const REFRACTORY = 0.3;
/** Wartezeit nach dem Anschlag bis zur Analyse: das Fenster liegt dann im klingenden Akkord */
const ANALYSIS_DELAY = 0.2;
/** Anstieg gegenüber dem leisesten Block der letzten ~60 ms */
const RISE = 2.2;
/** so weit über dem Grundrauschen muss ein Anschlag liegen */
const OVER_NOISE = 5;
/** absolute Untergrenze (RMS), damit Stille nie zählt */
const MIN_LEVEL = 0.002;
/** Gewicht der Obertöne in der Vorlage: 1, s, s², … */
const OVERTONE = 0.8;
/** Beträge im Profil verdichten (Wurzel), damit einzelne laute Teiltöne nicht alles bestimmen */
const POWER = 0.5;
/** zweite Gruppe entsteht, wenn ein Wert so weit (Anteil des erwarteten Abstands) von der ersten entfernt liegt */
const NEW_GROUP = 0.4;
/** gleitender Mittelwert der Gruppen über höchstens so viele Anschläge */
const GROUP_MEMORY = 8;

/** Radix-2-FFT in place; Länge muss eine Zweierpotenz sein. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

function normalize(v: number[]): number[] {
  const len = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  return len > 0 ? v.map((x) => x / len) : v;
}

/** Tonklassen-Profil (C = 0 … H = 11), Länge 1. */
export function chroma(samples: ArrayLike<number>, sampleRate: number, fMin = 120, fMax = 2000): number[] {
  const n = samples.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = samples[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const out = Array<number>(12).fill(0);
  const binHz = sampleRate / n;
  for (let k = Math.ceil(fMin / binHz); k <= Math.min(n / 2 - 1, Math.floor(fMax / binHz)); k++) {
    const f = k * binHz;
    const pc = (((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12) as number;
    out[pc]! += Math.hypot(re[k]!, im[k]!) ** POWER;
  }
  return normalize(out);
}

/** Obertöne 1–6 einer Saite: Abstand in Halbtönen (Oktave, Quinte, Doppeloktave, Terz, Quinte) */
const HARMONICS = [0, 12, 19, 24, 28, 31];

/**
 * Vorlage aus den gespielten Tönen eines Griffs (MIDI); doppelte Töne zählen mehr.
 * Mit Obertönen, weil eine Saite auch Quinte und Terz über ihrem Grundton klingen lässt.
 */
export function chordTemplate(midis: readonly number[], overtone = OVERTONE): number[] {
  const v = Array<number>(12).fill(0);
  for (const m of midis) HARMONICS.forEach((h, i) => (v[(((m + h) % 12) + 12) % 12]! += overtone ** i));
  return normalize(v);
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  return a.reduce((s, x, i) => s + x * b[i]!, 0);
}

/** Wert eines Profils: Ähnlichkeit zu Akkord 1 minus Ähnlichkeit zu Akkord 2. */
export function chordScore(profile: readonly number[], templates: readonly [number[], number[]]): number {
  return cosine(profile, templates[0]) - cosine(profile, templates[1]);
}

/**
 * Zählt Wechsel aus den Werten der Anschläge: zwei Gruppen, deren Mitte mitlernt.
 * `gap` = erwarteter Abstand der Gruppen (aus den Vorlagen).
 */
export class ChangeCounter {
  changes = 0;
  private means: number[] = [];
  private counts: number[] = [];
  private last = -1;

  constructor(private gap: number) {}

  push(score: number): void {
    let group: number;
    if (this.means.length === 0) group = 0;
    else if (this.means.length === 1) group = Math.abs(score - this.means[0]!) > this.gap * NEW_GROUP ? 1 : 0;
    else group = Math.abs(score - this.means[0]!) <= Math.abs(score - this.means[1]!) ? 0 : 1;
    if (group === this.means.length) {
      this.means.push(score);
      this.counts.push(1);
    } else {
      const n = this.counts[group]!;
      this.means[group] = (this.means[group]! * n + score) / (n + 1);
      this.counts[group] = Math.min(n + 1, GROUP_MEMORY);
    }
    if (this.last >= 0 && group !== this.last) this.changes++;
    this.last = group;
  }
}

export class ChangeDetector {
  /** erkannte Anschläge */
  strums = 0;
  /** je Anschlag: Ähnlichkeit zu Akkord 1 minus Ähnlichkeit zu Akkord 2 */
  scores: number[] = [];
  private counter: ChangeCounter;

  private ring = new Float32Array(WINDOW);
  private pos = 0;
  private t = 0;
  private hopSum = 0;
  private hopLen = 0;
  private recent: number[] = [];
  private noise = Infinity;
  private lastOnset = -Infinity;
  private analyzeAt: number | null = null;
  /** Anschläge zählen erst ab diesem Sample (z. B. nach dem Einzählen) */
  private armedFrom = 0;

  constructor(
    private sampleRate: number,
    private templates: readonly [number[], number[]],
  ) {
    this.counter = new ChangeCounter(this.expectedGap());
  }

  /** gezählte Akkordwechsel */
  get changes(): number {
    return this.counter.changes;
  }

  private expectedGap(): number {
    return 1 - cosine(this.templates[0], this.templates[1]);
  }

  /** Anschläge erst ab jetzt (plus `afterSeconds`, z. B. für den Startton) zählen; das Grundrauschen wird weiter gemessen. */
  arm(afterSeconds = 0): void {
    this.armedFrom = this.t + Math.round(afterSeconds * this.sampleRate);
    this.strums = 0;
    this.scores = [];
    this.counter = new ChangeCounter(this.expectedGap());
    // ein Anschlag, der noch vor dem Start liegt, wird nicht mehr ausgewertet
    this.analyzeAt = null;
  }

  /** Neue Samples (fortlaufend, ohne Überlappung). */
  feed(block: ArrayLike<number>): void {
    for (let i = 0; i < block.length; i++) {
      const x = block[i]!;
      this.ring[this.pos] = x;
      this.pos = (this.pos + 1) % WINDOW;
      this.t++;
      this.hopSum += x * x;
      if (++this.hopLen === HOP) this.processHop();
      if (this.analyzeAt !== null && this.t >= this.analyzeAt) this.analyze();
    }
  }

  private processHop(): void {
    const e = Math.sqrt(this.hopSum / HOP);
    this.hopSum = 0;
    this.hopLen = 0;
    // Grundrauschen: folgt leisen Stellen sofort, steigt nur langsam (~2 dB/s)
    this.noise = Math.min(e, this.noise === Infinity ? e : this.noise * 1.0025);
    const floor = this.recent.length ? Math.min(...this.recent) : e;
    this.recent.push(e);
    if (this.recent.length > Math.round((0.06 * this.sampleRate) / HOP)) this.recent.shift();
    const loud = e > Math.max(MIN_LEVEL, this.noise * OVER_NOISE);
    const rising = e > floor * RISE;
    const free = this.t - this.lastOnset > REFRACTORY * this.sampleRate;
    if (loud && rising && free) {
      this.lastOnset = this.t;
      if (this.t >= this.armedFrom) {
        this.strums++;
        this.analyzeAt = this.t + Math.round(ANALYSIS_DELAY * this.sampleRate);
      }
    }
  }

  private analyze(): void {
    this.analyzeAt = null;
    const win = new Float32Array(WINDOW);
    for (let i = 0; i < WINDOW; i++) win[i] = this.ring[(this.pos + i) % WINDOW]!;
    const score = chordScore(chroma(win, this.sampleRate), this.templates);
    this.scores.push(score);
    this.counter.push(score);
  }
}
