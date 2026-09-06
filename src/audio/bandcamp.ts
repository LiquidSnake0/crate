import type { Track } from '../model/types';
import type { AudioSource } from './source';

/**
 * Bandcamp comme source de lecture n'est pas branchable depuis une page web, et
 * ce n'est pas un manque de volonte :
 *
 *  - il n'existe pas d'API fan. L'API publique de Bandcamp couvre la gestion de
 *    catalogue et les ventes cote artiste ou label, pas la collection d'un acheteur ;
 *  - les flux audio des pages sont servis par des URL signees et temporaires, et
 *    aucune n'autorise le CORS, donc une PWA ne peut ni les lire ni les relayer ;
 *  - une extension de navigateur contournerait le CORS mais n'existe pas sur iOS
 *    dans Chrome, et sous Safari une extension est une app native a distribuer.
 *
 * Ce qui reste faisable aujourd'hui, et que fait cette source : ouvrir le morceau
 * dans Bandcamp. L'app garde la jugeote et la base, l'ecoute se fait a cote.
 * L'implementation reste derriere la meme interface : si un chemin s'ouvre un
 * jour, seul ce fichier change.
 */
export class BandcampLinkSource implements AudioSource {
  readonly id = 'bandcamp';
  readonly label = 'Bandcamp (lien, pas de lecture)';
  readonly unavailableLabel = 'Ouvrir dans Bandcamp';

  canPlay(): boolean {
    return false;
  }

  async resolve(): Promise<string | null> {
    return null;
  }

  release(): void {}

  /** Page de recherche Bandcamp pour ce morceau. */
  searchUrl(track: Track): string {
    const q = encodeURIComponent(`${track.artist} ${track.title}`);
    return `https://bandcamp.com/search?q=${q}`;
  }
}
