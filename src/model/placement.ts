import type { Track } from './types';
import { discOf } from './types';

// Selim ne reconnait pas un morceau a son titre : il le reconnait a la pochette,
// a la face, et au rang du morceau sur cette face. "B4" veut dire quatrieme
// morceau de la face B. C'est ce couple qui doit etre gros a l'ecran.
//
// Le rang sur la face n'est pas saisi : il se deduit du numero de piste de
// l'album, en repartant a 1 a chaque face. Le saisir a la main serait une
// deuxieme source de verite a maintenir.

export interface Placement {
  /** Ex "B4". Vide tant que la face n'est pas renseignee. */
  code: string;
  index: number | null;
}

export function buildPlacements(tracks: Track[]): Map<string, Placement> {
  const byDiscSide = new Map<string, Track[]>();
  for (const t of tracks) {
    if (!t.side) continue;
    const k = `${discOf(t)}|${t.side}`;
    const list = byDiscSide.get(k);
    if (list) list.push(t);
    else byDiscSide.set(k, [t]);
  }

  const out = new Map<string, Placement>();
  for (const [, list] of byDiscSide) {
    list.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
    list.forEach((t, i) => {
      out.set(t.id, { code: `${t.side}${i + 1}`, index: i + 1 });
    });
  }
  for (const t of tracks) {
    if (!out.has(t.id)) out.set(t.id, { code: '', index: null });
  }
  return out;
}
