import { db, trackId, setCover } from './db';
import type { Track } from '../model/types';
import { discOf } from '../model/types';
import { extractCover } from './id3';

// Safari iOS n'a pas de File System Access API : impossible de pointer un dossier
// et de le garder. Le seul chemin est le selecteur de fichiers, qui rend des File
// que l'on copie. Sur Chrome desktop on pourrait garder un handle, mais deux
// chemins d'import pour un seul besoin ne valent pas la complexite.

const NAME_RE = /^(.+?)\s+-\s+(.+?)\s+-\s+(\d{1,3})\s+(.+)\.mp3$/i;

/** Convention Bandcamp : "Artist - Album - 01 Title.mp3". */
export function parseFileName(name: string): {
  artist: string; album: string; trackNumber: number; title: string;
} | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  return {
    artist: m[1].trim(),
    album: m[2].trim(),
    trackNumber: Number(m[3]),
    title: m[4].trim(),
  };
}

export interface ImportReport {
  linked: number;
  unmatched: string[];
  bytes: number;
  covers: number;
}

/**
 * Rattache des fichiers aux morceaux existants. Un fichier qui ne correspond a
 * rien n'est PAS ajoute au crate : le crate est la liste physique des disques,
 * pas le contenu d'un dossier. Il est signale, a Selim de voir.
 */
export async function importFiles(files: FileList | File[]): Promise<ImportReport> {
  const list = Array.from(files);
  const byId = new Map((await db.tracks.toArray()).map((t) => [t.id, t]));
  const report: ImportReport = { linked: 0, unmatched: [], bytes: 0, covers: 0 };
  const seenDiscs = new Set<string>();

  for (const file of list) {
    const parsed = parseFileName(file.name);
    const match = parsed ? byId.get(trackId(parsed)) : undefined;
    if (!match) {
      report.unmatched.push(file.name);
      continue;
    }
    const audioId = match.id;
    await db.audio.put({ id: audioId, fileName: file.name, size: file.size, blob: file });
    await db.tracks.update(match.id, { audioId } satisfies Partial<Track>);
    report.linked += 1;
    report.bytes += file.size;

    // Une pochette par disque suffit : on ne relit pas l'en-tete des quinze pistes.
    const disc = discOf(match);
    if (!seenDiscs.has(disc)) {
      seenDiscs.add(disc);
      const cover = await extractCover(file);
      if (cover && (await setCover(disc, cover, 'id3'))) report.covers += 1;
    }
  }
  return report;
}

export async function audioUrl(audioId: string): Promise<string | null> {
  const row = await db.audio.get(audioId);
  return row ? URL.createObjectURL(row.blob) : null;
}

export async function audioStats(): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;
  await db.audio.each((row) => {
    count += 1;
    bytes += row.size;
  });
  return { count, bytes };
}
