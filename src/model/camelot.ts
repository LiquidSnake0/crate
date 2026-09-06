// Derivation du tag Camelot pitche.
//
// Le tag n'est PAS une donnee : c'est une vue sur (cle, bpm, bpm joue).
// Le stocker, c'est se condamner a le maintenir a la main et a le desynchroniser
// des qu'un bpm est corrige. Cette formule reproduit les 249 tags du Sheet.
//
// Grammaire des prefixes, relevee dans le Sheet :
//   ↓  palier bas  (82)      ↑  palier haut (97)      •  palier median (85-91) ou natif
//   !  pitch > 8 %           ⚠  aucun palier atteignable, joue natif
//   ★  jungle (crate separe)

export type Prefix = '↓' | '•' | '↑' | '⚠' | '★';

export const ANCHORS = [82, 87, 97] as const;
/** Au-dela, on est dans la jungle : crate separe, pas de pitch. */
export const JUNGLE_BPM = 120;
/** Zone ou le bpm natif se joue tel quel, sans chercher un palier. */
export const NATIVE_BAND: readonly [number, number] = [84, 92];
/** Pitch au-dela duquel le tag porte un `!`. */
export const STRONG_PITCH = 0.08;
/** Pitch au-dela duquel un palier est considere inatteignable. */
export const MAX_PITCH = 0.15;

const KEY_RE = /^(\d{1,2})([AB])$/;

export function parseKey(key: string): { n: number; letter: 'A' | 'B' } | null {
  const m = KEY_RE.exec(key.trim().toUpperCase());
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 12) return null;
  return { n, letter: m[2] as 'A' | 'B' };
}

/**
 * Un demi-ton vers le haut avance d'une quinte sur la roue Camelot,
 * soit +7 positions modulo 12. La lettre ne bouge pas.
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

/**
 * Palier suggere pour un bpm donne. C'est une proposition pour les lignes
 * vides, jamais une correction : si `anchorBpm` est renseigne, il gagne.
 */
export function suggestAnchor(bpm: number): number {
  if (bpm >= JUNGLE_BPM) return bpm;
  if (bpm >= NATIVE_BAND[0] && bpm <= NATIVE_BAND[1]) return bpm;
  const reachable = ANCHORS.filter((a) => Math.abs(a / bpm - 1) <= MAX_PITCH);
  if (reachable.length === 0) return bpm;
  return reachable.reduce((best, a) =>
    Math.abs(a / bpm - 1) < Math.abs(best / bpm - 1) ? a : best,
  );
}

export interface Tag {
  /** Le tag complet, ex "↓3B" ou "↑9A!". */
  text: string;
  prefix: Prefix;
  /** Camelot apres pitch, ex "3B". */
  camelot: string;
  semitones: number;
  /** Ecart de pitch, -0.056 pour -5,6 %. */
  pitch: number;
  strong: boolean;
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
  const strong = Math.abs(pitch) > STRONG_PITCH;

  let prefix: Prefix;
  if (anchor >= JUNGLE_BPM) prefix = '★';
  else if (anchor === 82) prefix = '↓';
  else if (anchor === 97) prefix = '↑';
  else if (Math.abs(anchor - bpm) < 0.01 && !isReachable(bpm)) prefix = '⚠';
  else prefix = '•';

  return {
    text: `${prefix}${camelot}${strong ? '!' : ''}`,
    prefix,
    camelot,
    semitones,
    pitch,
    strong,
  };
}

function isReachable(bpm: number): boolean {
  if (bpm >= NATIVE_BAND[0] && bpm <= NATIVE_BAND[1]) return true;
  return ANCHORS.some((a) => Math.abs(a / bpm - 1) <= MAX_PITCH);
}

/** Le tag calcule contredit-il celui saisi dans le Sheet ? */
export function tagConflict(legacy: string | null, derived: Tag | null): boolean {
  if (!legacy || !derived) return false;
  return normalise(legacy) !== normalise(derived.text);
}

function normalise(tag: string): string {
  return tag.replace(/^[↑↓•⚠★]/, '').replace(/!$/, '').trim().toUpperCase();
}
