import type { Track, Family } from './types';
import { discOf } from './types';
import { parseKey, suggestAnchor } from './camelot';

// Classement des enchainements possibles depuis le morceau en cours.
//
// Trois axes, comme sur les etiquettes : le tempo, la couleur, la roue Camelot.
// Ils se multiplient, ils ne s'additionnent pas : un axe a zero doit tuer le
// candidat, pas se faire rattraper par les deux autres.
//
// LE TEMPO EST UNE RAMPE, PAS UNE TRANCHE. Sur un set d'une heure chaque morceau
// gagne environ 1 BPM, ce qui mene de 82 a 97 en dix-sept morceaux. Passer d'une
// tranche a l'autre n'est donc pas un mur : c'est ce que fait le set en entier.
// Un enchainement isole, lui, doit rester proche de la cible du moment.

export interface Weights {
  /** BPM gagnes par morceau. 1 sur un set d'une heure, moins si le set est long. */
  ramp: number;
  tempo: number;
  color: number;
  camelot: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  ramp: 1,
  tempo: 1,
  color: 1,
  camelot: 1,
};

/**
 * Les deux voies de la palette, telles que les stickers les dessinent : les bleus
 * et les verts vont du clair au fonce, le rose ouvre et le violet ferme. Passer
 * d'une voie a l'autre au meme niveau coute moins qu'un saut de deux crans.
 *
 * HYPOTHESE A VALIDER : elle vient de la forme de la palette, pas d'une regle
 * que Selim a ecrite.
 */
const LANE: Record<Family, { lane: 'M' | 'B' | 'end' | 'special'; level: number }> = {
  'R': { lane: 'end', level: 0 },
  'M-': { lane: 'M', level: 1 }, 'M': { lane: 'M', level: 2 }, 'M+': { lane: 'M', level: 3 },
  'B-': { lane: 'B', level: 1 }, 'B': { lane: 'B', level: 2 }, 'B+': { lane: 'B', level: 3 },
  'V': { lane: 'end', level: 4 },
  'S-': { lane: 'special', level: 2 },
  'S': { lane: 'special', level: 9 },
  'S+': { lane: 'special', level: 9 },
};

export function colorFactor(from: Family | null, to: Family | null): number {
  if (!from || !to) return 0.5; // inconnu : ni favorise ni exclu
  if (from === to) return 1;
  const a = LANE[from];
  const b = LANE[to];

  // Les speciaux sont un crate a part : on n'y entre ni n'en sort par hasard.
  if (a.lane === 'special' || b.lane === 'special') {
    return a.lane === b.lane ? 0.8 : 0.05;
  }
  const gap = Math.abs(a.level - b.level);
  if (a.lane === b.lane || a.lane === 'end' || b.lane === 'end') {
    return gap <= 1 ? 0.7 : gap === 2 ? 0.25 : 0.1;
  }
  // Voies differentes : le meme niveau passe, l'ecart coute cher.
  return gap === 0 ? 0.45 : gap === 1 ? 0.2 : 0.08;
}

/** Distance sur la roue Camelot, en pas les plus courts. */
export function camelotFactor(from: string | null, to: string | null): number {
  const a = from ? parseKey(from) : null;
  const b = to ? parseKey(to) : null;
  if (!a || !b) return 0.6; // tag manquant : on ne penalise pas une donnee absente
  const step = Math.min(
    (((a.n - b.n) % 12) + 12) % 12,
    (((b.n - a.n) % 12) + 12) % 12,
  );
  if (a.letter === b.letter) {
    if (step === 0) return 1;
    if (step === 1) return 0.85;
    if (step === 2) return 0.4;
    return 0.15;
  }
  // Relative majeure ou mineure : meme numero, autre lettre.
  if (step === 0) return 0.9;
  return step === 1 ? 0.3 : 0.1;
}

/** Largeur de la cloche autour du tempo cible, en BPM. */
export const TEMPO_SIGMA = 4;

/**
 * Le candidat ideal est au tempo cible.
 *
 * Decroissance continue et non par paliers : avec une rampe a 1 BPM par morceau,
 * le moindre palier plus large que le pas rendrait la rampe invisible, et a
 * 0,1 BPM ce serait pire. La cloche garde un ordre strict a n'importe quel pas.
 */
export function tempoFactor(candidateBpm: number, targetBpm: number): number {
  const gap = (candidateBpm - targetBpm) / TEMPO_SIGMA;
  return Math.exp(-gap * gap);
}

/** Duree moyenne d'un morceau du crate, pour estimer combien il en reste a jouer. */
export function averageDuration(tracks: Track[]): number {
  const known = tracks.map((t) => t.durationSec).filter((d): d is number => !!d);
  if (known.length === 0) return 285;
  return known.reduce((a, b) => a + b, 0) / known.length;
}

export interface RampPlan {
  /** BPM gagnes par morceau pour arriver en haut a la fin du set. */
  step: number;
  playedSec: number;
  remainingSec: number;
  remainingTracks: number;
}

/**
 * Le pas de la rampe deduit de la duree du set plutot que regle a la main.
 *
 * Sur les durees reelles du crate, 285 s en moyenne, une heure fait 12,6 morceaux
 * et mener 82 a 97 y demande 1,19 BPM par morceau. C'est exactement la regle du
 * "+1 BPM" que Selim appliquait a l'oreille : le calcul la retrouve.
 *
 * Le pas est recalcule a chaque morceau : prendre du retard le fait monter.
 */
export function rampPlan(
  currentBpm: number,
  playedSec: number,
  setMinutes: number,
  avgDuration: number,
  topBpm = 97,
): RampPlan {
  const remainingSec = Math.max(0, setMinutes * 60 - playedSec);
  const remainingTracks = Math.max(1, Math.round(remainingSec / avgDuration));
  const step = Math.max(0, (topBpm - currentBpm) / remainingTracks);
  return { step, playedSec, remainingSec, remainingTracks };
}

export function playedBpm(t: Track): number | null {
  if (t.anchorBpm) return t.anchorBpm;
  return t.bpm ? suggestAnchor(t.bpm) : null;
}

export interface Candidate {
  track: Track;
  score: number;
  tempo: number;
  color: number;
  camelot: number;
  /** Ce que Selim a deja juge sur cette paire, s'il l'a jugee. */
  verdict: 'oui' | 'non' | null;
  bpm: number | null;
}

export interface RankOptions {
  weights: Weights;
  /** Verdicts deja rendus, clefs `from>to`. */
  verdicts?: Map<string, 'oui' | 'non'>;
}

export function pairKey(from: Track, to: Track): string {
  return `${from.id}>${to.id}`;
}

/**
 * Classe les suites possibles depuis `current`.
 *
 * Un verdict rendu domine toujours le calcul : le calcul sert a ordonner ce qui
 * n'a pas encore ete juge, jamais a corriger un jugement.
 */
export function rankNext(
  current: Track,
  pool: Track[],
  { weights, verdicts }: RankOptions,
): Candidate[] {
  const fromBpm = playedBpm(current);
  const target = (fromBpm ?? 82) + weights.ramp;
  const fromDisc = discOf(current);

  const out: Candidate[] = [];
  for (const t of pool) {
    if (t.id === current.id) continue;
    // Contrainte dure : jamais deux faces du meme disque d'affilee.
    if (discOf(t) === fromDisc) continue;

    const bpm = playedBpm(t);
    const tempo = bpm === null ? 0.3 : tempoFactor(bpm, target);
    const color = colorFactor(current.family, t.family);
    const camelot = camelotFactor(current.key, t.key);

    const base =
      Math.pow(tempo, weights.tempo) *
      Math.pow(color, weights.color) *
      Math.pow(camelot, weights.camelot);

    const verdict = verdicts?.get(pairKey(current, t)) ?? null;
    const score = verdict === 'oui' ? 1 : verdict === 'non' ? 0 : base;

    out.push({ track: t, score, tempo, color, camelot, verdict, bpm });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
