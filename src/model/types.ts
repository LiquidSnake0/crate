// Le crate physique. Un disque a des faces (stickers A/B/C/D), une face porte des morceaux.
// Ici l'unite editable est le morceau : c'est ce que Selim corrige un par un.

export type Side = 'A' | 'B' | 'C' | 'D';
export const SIDES: readonly Side[] = ['A', 'B', 'C', 'D'];

// Codes tels qu'ils sont ecrits dans le Sheet, pas des noms inventes.
export type Family =
  | 'R'
  | 'M-' | 'M' | 'M+'
  | 'B-' | 'B' | 'B+'
  | 'S-' | 'S' | 'S+'
  | 'V';

export const FAMILIES: readonly Family[] = [
  'R', 'M-', 'M', 'M+', 'B-', 'B', 'B+', 'S-', 'S', 'S+', 'V',
];

// Couleurs des stickers physiques. Elles ne sont pas negociables, ce sont
// celles collees sur les pochettes.
export const FAMILY_COLOR: Record<Family, string> = {
  'R': '#e879a6',
  'M-': '#7fb3e8', 'M': '#3d7fc4', 'M+': '#1e4d80',
  'B-': '#86d6a3', 'B': '#3faa6a', 'B+': '#1f6b41',
  'S-': '#f0d97a', 'S': '#e0bb3c', 'S+': '#b8901a',
  'V': '#9b6fd4',
};

export interface Track {
  id: string;
  artist: string;
  album: string;
  title: string;
  trackNumber: number | null;

  /** Camelot natif du morceau, ex "8B". Corrigeable. */
  key: string | null;
  /** BPM reel du fichier. Corrigeable. */
  bpm: number | null;
  /** BPM auquel Selim le joue. Sa decision, pas un calcul. */
  anchorBpm: number | null;

  side: Side | null;
  family: Family | null;

  /** Tag tel qu'il etait dans le Sheet, garde pour comparaison. Jamais reecrit. */
  legacyTag: string | null;

  notes: string;
  /** Cle du blob audio dans la table `audio`, si le fichier a ete importe. */
  audioId: string | null;
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
