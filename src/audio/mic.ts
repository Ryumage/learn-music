import { audioContext } from './pluck';

export interface MicListener {
  sampleRate: number;
  stop(): void;
}

/** Warum das Mikrofon nicht startet – als Text für die Oberfläche. */
export function micErrorText(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Kein Zugriff aufs Mikrofon. Erlaube ihn in den iPhone-Einstellungen unter Safari → Mikrofon (bzw. beim nächsten Start mit „Erlauben“).';
  if (name === 'NotFoundError') return 'Kein Mikrofon gefunden.';
  return 'Das Mikrofon ließ sich nicht starten.';
}

/**
 * Mikrofon öffnen und fortlaufend Samples liefern. Die Aufnahme bleibt im Gerät, nichts wird gespeichert
 * oder verschickt. Automatische Lautstärke und Rauschunterdrückung sind aus, damit Anschläge erhalten bleiben.
 */
export async function listen(onSamples: (block: Float32Array) => void): Promise<MicListener> {
  const ctx = audioContext();
  if (!ctx || !navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no mic'), { name: 'NotFoundError' });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessor ist veraltet, läuft aber überall (auch iOS) ohne eigene Worklet-Datei
  const proc = ctx.createScriptProcessor(2048, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  proc.onaudioprocess = (e) => onSamples(e.inputBuffer.getChannelData(0));
  source.connect(proc);
  // iOS ruft onaudioprocess nur auf, wenn der Knoten mit dem Ausgang verbunden ist
  proc.connect(mute).connect(ctx.destination);
  return {
    sampleRate: ctx.sampleRate,
    stop() {
      proc.onaudioprocess = null;
      source.disconnect();
      proc.disconnect();
      mute.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
