// Le crate physique. Un disque a des faces (stickers A/B/C/D), une face porte
// des morceaux. L'unite editable est le morceau : c'est ce qu'on corrige un par un.

export type Side = 'A' | 'B' | 'C' | 'D';
export const SIDES: readonly Side[] = ['A', 'B', 'C', 'D'];

export type Family =
  | 'R'
  | 'M-' | 'M' | 'M+'
  | 'B-' | 'B' | 'B+'
  | 'V'
  | 'S-' | 'S' | 'S+';

// Ordre des stickers : rose, les trois bleus, les trois verts, violet, puis les
// speciaux. On classe par couleur, pas par code.
export const FAMILIES: readonly Family[] = [
  'R', 'M-', 'M', 'M+', 'B-', 'B', 'B+', 'V', 'S-', 'S', 'S+',
];

/**
 * Les familles proposees a la saisie. `S+` en est absent : il partage le noir
 * de `S`, donc sans le code ecrit a cote les deux seraient indistinguables, et
 * il ne compte aucune piste dans le classeur. Le type le garde pour ne pas
 * casser une donnee existante.
 */
export const PICKABLE_FAMILIES: readonly Family[] = FAMILIES.filter((f) => f !== 'S+');

/**
 * Couleurs des stickers physiques, relevees dans le classeur et validees le
 * 27 aout 2026 par mesure d'ecart DeltaE sur planche imprimee. La teinte porte
 * la famille, la clarte porte la nuance. Ne pas les retoucher sans refaire la mesure.
 *
 * `S` est noir : un special est une rupture, pas une nuance de plus, donc il sort
 * de la palette au lieu d'y etre range.
 */
export const FAMILY_COLOR: Record<Family, string> = {
  'R': '#EC407A',
  'M-': '#7FB3D5', 'M': '#2E86C1', 'M+': '#154360',
  'B-': '#C0CA33', 'B': '#689F38', 'B+': '#33691E',
  'V': '#6A1B9A',
  'S-': '#FFB74D',
  'S': '#000000',
  'S+': '#000000', // aucune piste dans le classeur, couleur non mesuree
};

/** Encre lisible sur la pastille : sombre sur clair, blanche sur sombre. */
export const FAMILY_INK: Record<Family, string> = {
  'R': '#ffffff',
  'M-': '#11202b', 'M': '#ffffff', 'M+': '#ffffff',
  'B-': '#1d2107', 'B': '#ffffff', 'B+': '#ffffff',
  'V': '#ffffff',
  'S-': '#2b1c05',
  'S': '#ffffff',
  'S+': '#ffffff',
};

export interface Track {
  id: string;
  artist: string;
  album: string;
  title: string;
  trackNumber: number | null;

  /** Camelot natif, ex "8B". Corrigeable. */
  key: string | null;
  /** BPM reel du morceau. Corrigeable. */
  bpm: number | null;
  /** BPM auquel Selim le joue. Sa decision, pas un calcul. */
  anchorBpm: number | null;

  side: Side | null;
  family: Family | null;

  /** Tag tel qu'il etait dans le classeur, temoin. Jamais reecrit. */
  legacyTag: string | null;

  notes: string;
  /** Cle du blob audio, si un fichier a ete importe. */
  audioId: string | null;
}

/** Un enchainement juge. Le jugement de Selim domine toujours le calcul. */
export interface Judgement {
  /** `${fromId}>${toId}` */
  id: string;
  fromId: string;
  toId: string;
  verdict: 'oui' | 'non';
  /** `live` : reellement joue aux platines. `ecoute` : juge au casque. */
  source: 'live' | 'ecoute';
  at: string;
}

/** Pochette d'un disque. La cle est `discOf(track)` : elle vaut pour tout le disque. */
export interface Cover {
  id: string;
  blob: Blob;
  /** D'ou elle vient, pour savoir si on peut l'ecraser sans perdre un choix manuel. */
  source: 'id3' | 'manuel';
}

/**
 * Ou en est le set. Persiste parce que Selim ecoute dans Bandcamp et revient :
 * sur iPhone une webapp mise en arriere-plan peut etre dechargee, et retrouver
 * un ecran vide au retour rendrait la boucle inutilisable.
 */
export interface LiveState {
  id: 'live';
  currentId: string | null;
  chain: string[];
  ramp: number;
  /** L'ecran ouvert. Revenir de Bandcamp sur le mauvais onglet ferait perdre sa place. */
  tab?: 'crate' | 'live';
}

export interface AudioBlob {
  id: string;
  fileName: string;
  size: number;
  blob: Blob;
}

/** Un morceau est complet quand il peut entrer dans le graphe. */
export function missingFields(t: Track): string[] {
  const out: string[] = [];
  if (!t.key) out.push('cle');
  if (!t.bpm) out.push('bpm');
  if (!t.side) out.push('face');
  if (!t.family) out.push('famille');
  return out;
}

/** Le disque, pas la face : la contrainte "jamais deux faces du meme disque" s'y arrete. */
export function discOf(t: Track): string {
  return `${t.artist.toLowerCase()}|${t.album.toLowerCase()}`;
}
