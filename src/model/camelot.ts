// Derivation du tag.
//
// Le tag n'est PAS une donnee : c'est une vue sur (cle, bpm, bpm joue). Le stocker,
// c'est le desynchroniser des la premiere correction de bpm.
//
// Systeme a trois tranches, arrete le 26 aout 2026. La fleche designe LA TRANCHE,
// pas la direction du fader : la direction se regle a l'oreille au beatmatch, alors
// que la tranche est un etat porte toute la soiree, qu'il faut pouvoir relire d'un
// coup d'oeil sur l'etiquette.

export type Prefix = '↓' | '•' | '↑' | '⚠' | '★';

/** Bornes de bpm natif de chaque tranche. */
export const SLICES = {
  low: { max: 82, play: 82 },
  mid: { max: 92, floor: 85 },
  high: { max: 110, play: 97 },
} as const;

/** Au-dela, morceau special : joue natif, crate separe. */
export const SPECIAL_BPM = 122;

/** Fader d'une PLX MK7 : +-8 % par defaut, +-16 % en mode etendu. */
export const FADER_DEFAULT = 0.08;
export const FADER_MAX = 0.16;

const KEY_RE = /^(\d{1,2})([AB])$/;

export function parseKey(key: string): { n: number; letter: 'A' | 'B' } | null {
  const m = KEY_RE.exec(key.trim().toUpperCase());
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 12) return null;
  return { n, letter: m[2] as 'A' | 'B' };
}

/**
 * Un demi-ton vers le haut avance d'une quinte sur la roue Camelot, soit
 * +7 positions modulo 12. La lettre ne bouge jamais.
 */
export function shiftCamelot(key: string, semitones: number): string | null {
  const k = parseKey(key);
  if (!k) return null;
  const n = (((k.n - 1 + 7 * semitones) % 12) + 12) % 12;
  return `${n + 1}${k.letter}`;
}

export function semitonesBetween(fromBpm: number, toBpm: number): number {
  return Math.round(12 * Math.log2(toBpm / fromBpm));
}

function reachable(bpm: number, target: number): boolean {
  return Math.abs(target / bpm - 1) <= FADER_MAX;
}

/**
 * BPM auquel le morceau se joue, deduit de sa tranche. Proposition pour un champ
 * vide : une valeur saisie par Selim gagne toujours.
 *
 * Verifie sur les 245 morceaux tagues du classeur : 245 d'accord, 0 divergent.
 */
export function suggestAnchor(bpm: number): number {
  if (bpm >= SPECIAL_BPM) return bpm;
  if (bpm <= SLICES.low.max) {
    return reachable(bpm, SLICES.low.play) ? SLICES.low.play : bpm;
  }
  if (bpm <= SLICES.mid.max) return Math.max(bpm, SLICES.mid.floor);
  if (bpm <= SLICES.high.max) {
    return reachable(bpm, SLICES.high.play) ? SLICES.high.play : bpm;
  }
  return bpm;
}

/** La tranche se lit sur le bpm natif, pas sur le bpm joue. */
export function sliceOf(bpm: number): Prefix {
  if (bpm >= SPECIAL_BPM) return '★';
  if (bpm <= SLICES.low.max) return reachable(bpm, SLICES.low.play) ? '↓' : '⚠';
  if (bpm <= SLICES.mid.max) return '•';
  if (bpm <= SLICES.high.max) return reachable(bpm, SLICES.high.play) ? '↑' : '⚠';
  return '⚠';
}

export interface Tag {
  /** Le tag complet, ex "↓3B" ou "↑9A!". */
  text: string;
  prefix: Prefix;
  /** Camelot apres transposition, ex "3B". */
  camelot: string;
  semitones: number;
  /** Ecart de pitch, -0.056 pour -5,6 %. */
  pitch: number;
  /** Depasse les +-8 % du fader : passer la platine en +-16 avant de lancer. */
  extendedFader: boolean;
}

export function deriveTag(
  key: string | null,
  bpm: number | null,
  anchorBpm: number | null,
): Tag | null {
  if (!key || !bpm || bpm <= 0) return null;
  const anchor = anchorBpm && anchorBpm > 0 ? anchorBpm : suggestAnchor(bpm);
  const semitones = semitonesBetween(bpm, anchor);
  const camelot = shiftCamelot(key, semitones);
  if (!camelot) return null;

  const pitch = anchor / bpm - 1;
  const extendedFader = Math.abs(pitch) > FADER_DEFAULT;

  return {
    text: `${sliceOf(bpm)}${camelot}${extendedFader ? '!' : ''}`,
    prefix: sliceOf(bpm),
    camelot,
    semitones,
    pitch,
    extendedFader,
  };
}

/** Le tag calcule contredit-il celui saisi dans le classeur ? */
export function tagConflict(legacy: string | null, derived: Tag | null): boolean {
  if (!legacy || !derived) return false;
  return legacy.trim().toUpperCase() !== derived.text.toUpperCase();
}
