import type { Track } from '../model/types';
import { deriveTag, parseKey } from '../model/camelot';
import type { AudioSource } from './source';

/**
 * Source de test : un WAV synthetise a la volee, sans aucun fichier.
 *
 * Il ne joue pas n'importe quoi. La hauteur suit la cle Camelot et les clics
 * suivent le bpm joue, donc on entend si le lecteur a charge le bon morceau et
 * si l'enchainement part au bon moment. C'est la seule facon de tester la boucle
 * de jugement avant d'avoir les fichiers.
 */
export class MockAudioSource implements AudioSource {
  readonly id = 'mock';
  readonly label = 'Mock (bip synthetise)';
  readonly unavailableLabel = 'Cle ou BPM manquant';

  private readonly seconds: number;

  constructor(seconds = 6) {
    this.seconds = seconds;
  }

  canPlay(track: Track): boolean {
    return Boolean(track.key && track.bpm);
  }

  async resolve(track: Track): Promise<string | null> {
    if (!this.canPlay(track)) return null;
    const tag = deriveTag(track.key, track.bpm, track.anchorBpm);
    const k = parseKey(tag?.camelot ?? track.key!);
    // La roue Camelot fait douze pas, on l'etale sur une octave.
    const hz = 220 * Math.pow(2, ((k?.n ?? 1) - 1) / 12);
    const bpm = track.anchorBpm ?? track.bpm ?? 90;
    return URL.createObjectURL(renderWav(hz, bpm, this.seconds));
  }

  release(url: string): void {
    URL.revokeObjectURL(url);
  }
}

function renderWav(hz: number, bpm: number, seconds: number): Blob {
  const rate = 8000;
  const frames = Math.floor(rate * seconds);
  const beat = (60 / bpm) * rate;

  const bytes = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(bytes);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + frames * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, frames * 2, true);

  for (let i = 0; i < frames; i += 1) {
    // Une enveloppe courte a chaque temps : on entend le tempo.
    const into = (i % beat) / beat;
    const env = Math.exp(-8 * into);
    const s = Math.sin((2 * Math.PI * hz * i) / rate) * env * 0.22;
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

function writeAscii(view: DataView, at: number, s: string): void {
  for (let i = 0; i < s.length; i += 1) view.setUint8(at + i, s.charCodeAt(i));
}
