import type { Track, Side } from './types';
import { SIDES } from './types';

// Decouper un album en faces.
//
// Bandcamp ne connait pas les faces d'un vinyle, et la duree ne permet pas de les
// deduire : les faces de Selim vont de 4,9 a 32,4 minutes, cela depend du pressage.
// En revanche l'ordre est sur, verifie sur ses treize albums deja renseignes :
// l'ordre de sa playlist suit exactement l'ordre (face, position). Il ne reste donc
// qu'a poser les coupures, une a trois par disque au lieu de cent treize saisies.

/** Indices apres lesquels la face change. Trie, sans doublon. */
export type Cuts = readonly number[];

export interface SidePlan {
  side: Side;
  tracks: Track[];
  seconds: number;
}

export function planSides(ordered: Track[], cuts: Cuts): SidePlan[] {
  const bounds = [...new Set(cuts)].filter((c) => c >= 0 && c < ordered.length - 1).sort((a, b) => a - b);
  const out: SidePlan[] = [];
  let start = 0;
  for (let i = 0; i <= bounds.length; i += 1) {
    const end = i < bounds.length ? bounds[i] : ordered.length - 1;
    const slice = ordered.slice(start, end + 1);
    if (slice.length > 0 && out.length < SIDES.length) {
      out.push({
        side: SIDES[out.length],
        tracks: slice,
        seconds: slice.reduce((s, t) => s + (t.durationSec ?? 0), 0),
      });
    }
    start = end + 1;
  }
  return out;
}

/**
 * Coupures a durees egales, comme point de depart. Selim ajuste ensuite : c'est
 * une proposition, pas une regle, puisque ses faces sont tres inegales.
 */
export function suggestCuts(ordered: Track[], sides: number): number[] {
  if (sides < 2 || ordered.length < sides) return [];
  const total = ordered.reduce((s, t) => s + (t.durationSec ?? 0), 0);
  if (total === 0) {
    // Sans duree, on coupe en parts egales de pistes.
    return Array.from({ length: sides - 1 }, (_, i) =>
      Math.round(((i + 1) * ordered.length) / sides) - 1,
    );
  }
  const cuts: number[] = [];
  let acc = 0;
  let next = 1;
  for (let i = 0; i < ordered.length - 1 && cuts.length < sides - 1; i += 1) {
    acc += ordered[i].durationSec ?? 0;
    if (acc >= (next * total) / sides) {
      cuts.push(i);
      next += 1;
    }
  }
  return cuts;
}

/** Ce qu'il faut ecrire en base : la face et le rang sur cette face. */
export function applySides(plans: SidePlan[]): { id: string; side: Side; trackNumber: number }[] {
  return plans.flatMap((p) =>
    p.tracks.map((t, i) => ({ id: t.id, side: p.side, trackNumber: i + 1 })),
  );
}
