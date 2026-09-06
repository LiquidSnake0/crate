import type { Track } from '../model/types';
import type { AudioSource } from './source';
import { audioUrl } from '../db/audio';

/** Fichiers importes dans IndexedDB. Autonome, hors ligne, mais 1 a 2 Go. */
export class LocalFileSource implements AudioSource {
  readonly id = 'local';
  readonly label = 'Fichiers importes';
  readonly unavailableLabel = 'Pas de fichier';

  canPlay(track: Track): boolean {
    return Boolean(track.audioId);
  }

  async resolve(track: Track): Promise<string | null> {
    return track.audioId ? audioUrl(track.audioId) : null;
  }

  release(url: string): void {
    URL.revokeObjectURL(url);
  }
}
