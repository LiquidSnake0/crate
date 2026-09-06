import type { Track } from '../model/types';
import { discOf } from '../model/types';
import { db, setCover } from './db';

// Import de pochettes en lot.
//
// Les images telechargees de Bandcamp s'appellent rarement d'apres l'album :
// souvent `cover.jpg`, parfois un identifiant. Ce qui porte le nom de l'album,
// c'est le DOSSIER. On lit donc `webkitRelativePath` en priorite, ce qui permet
// de deposer un dossier entier de disques d'un coup.

/** Reduit une image pour l'affichage. 24 pochettes Bandcamp pesent 12 Mo, ici 1,5. */
export const COVER_MAX_PX = 600;

export async function shrink(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, COVER_MAX_PX / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 200_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const out = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, 'image/jpeg', 0.85),
  );
  return out && out.size < file.size ? out : file;
}

function norm(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/, '')
    .replace(/[\s_·・\-–—]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim();
}

export interface Disc {
  id: string;
  artist: string;
  album: string;
  tracks: number;
}

export function listDiscs(tracks: Track[]): Disc[] {
  const map = new Map<string, Disc>();
  for (const t of tracks) {
    const id = discOf(t);
    const d = map.get(id);
    if (d) d.tracks += 1;
    else map.set(id, { id, artist: t.artist, album: t.album, tracks: 1 });
  }
  return [...map.values()].sort(
    (a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album),
  );
}

/**
 * Le disque vise par le chemin d'une image, ou null si le chemin n'en designe
 * pas exactement un. Sorti de l'import pour etre testable sans navigateur.
 */
export function matchDisc(
  path: string,
  discs: Disc[],
): Disc | null {
  const p = norm(path);
  let hits = discs.filter((d) => norm(d.album).length > 2 && p.includes(norm(d.album)));
  // Un titre d'album court peut viser plusieurs disques : l'artiste tranche.
  if (hits.length > 1) {
    const narrowed = hits.filter((d) => p.includes(norm(d.artist)));
    if (narrowed.length > 0) hits = narrowed;
  }
  return hits.length === 1 ? hits[0] : null;
}

export interface CoverImportReport {
  matched: number;
  skipped: number;
  unmatched: string[];
}

/**
 * Associe chaque image au disque dont le nom apparait dans son chemin.
 * Quand plusieurs images visent le meme disque, la plus lourde gagne : c'est
 * la pleine resolution plutot qu'une vignette.
 */
export async function importCovers(
  files: File[],
  tracks: Track[],
): Promise<CoverImportReport> {
  const discs = listDiscs(tracks);
  const best = new Map<string, File>();
  const report: CoverImportReport = { matched: 0, skipped: 0, unmatched: [] };

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const path =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;

    const disc = matchDisc(path, discs);
    if (!disc) {
      report.unmatched.push(file.name);
      continue;
    }
    // Plusieurs images pour un meme disque : la plus lourde est la pleine
    // resolution, pas la vignette.
    const current = best.get(disc.id);
    if (!current || file.size > current.size) best.set(disc.id, file);
  }

  for (const [discId, file] of best) {
    const written = await setCover(discId, await shrink(file), 'id3');
    if (written) report.matched += 1;
    else report.skipped += 1;
  }
  return report;
}

export async function coveredDiscIds(): Promise<Set<string>> {
  return new Set((await db.covers.toArray()).map((c) => c.id));
}
