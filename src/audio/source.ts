import type { Track } from '../model/types';

/**
 * D'ou vient le son. L'app ne sait pas jouer de la musique, elle sait demander
 * une URL a une source et la donner a un <audio>. Tout le reste, la jugeote et
 * la base, ne depend pas de la source.
 *
 * Trois implementations : le mock pour travailler sans fichiers, les fichiers
 * locaux dans IndexedDB, et Bandcamp le jour ou c'est possible.
 */
export interface AudioSource {
  readonly id: string;
  readonly label: string;
  /** Ce que l'interface affiche quand un morceau n'est pas jouable ici. */
  readonly unavailableLabel: string;

  canPlay(track: Track): boolean;
  /** URL utilisable par un element <audio>, ou null si indisponible. */
  resolve(track: Track): Promise<string | null>;
  /** Libere ce que `resolve` a alloue. */
  release(url: string): void;
}
