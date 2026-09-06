import Dexie, { type Table } from 'dexie';
import type { Track, AudioBlob } from '../model/types';
import seed from '../data/seed.json';

// Deux tables, deux durees de vie tres differentes :
//  - `tracks` est le travail de Selim. Quelques dizaines de Ko. Precieux, exporte.
//  - `audio` est le contenu des MP3. Un a deux Go. Jetable, reimportable.
// Safari peut evincer le stockage sous pression disque. Perdre `audio` doit etre
// un non-evenement : on reselectionne les fichiers. Perdre `tracks` ne doit
// jamais arriver, d'ou l'export JSON.

class CrateDb extends Dexie {
  tracks!: Table<Track, string>;
  audio!: Table<AudioBlob, string>;

  constructor() {
    super('crate');
    this.version(1).stores({
      tracks: 'id, artist, album, side, family, audioId',
      audio: 'id',
    });
  }
}

export const db = new CrateDb();

function slug(...parts: (string | number | null)[]): string {
  return parts
    .map((p) => String(p ?? '').trim().toLowerCase())
    .join('|')
    .replace(/\s+/g, ' ');
}

export function trackId(t: {
  artist: string; album: string; trackNumber: number | null; title: string;
}): string {
  return slug(t.artist, t.album, t.trackNumber, t.title);
}

interface SeedRow {
  artist: string; album: string; title: string; trackNumber: number | null;
  key: string | null; bpm: number | null; anchorBpm: number | null;
  side: string | null; family: string | null; legacyTag: string | null;
}

/**
 * Ne s'execute qu'une fois, sur une base vide. Reouvrir l'app ne doit jamais
 * ecraser une correction faite a la main.
 */
export async function seedIfEmpty(): Promise<number> {
  const count = await db.tracks.count();
  if (count > 0) return 0;

  const rows = (seed as SeedRow[]).map((r) => ({
    id: trackId(r),
    artist: r.artist,
    album: r.album,
    title: r.title,
    trackNumber: r.trackNumber,
    key: r.key,
    bpm: r.bpm,
    anchorBpm: r.anchorBpm,
    side: (r.side as Track['side']) ?? null,
    family: (r.family as Track['family']) ?? null,
    legacyTag: r.legacyTag,
    notes: '',
    audioId: null,
  })) satisfies Track[];

  await db.tracks.bulkPut(rows);
  return rows.length;
}

export async function updateTrack(id: string, patch: Partial<Track>): Promise<void> {
  await db.tracks.update(id, patch);
}

/** Export sans les blobs : c'est le travail qu'on sauvegarde, pas la musique. */
export async function exportJson(): Promise<string> {
  const tracks = await db.tracks.toArray();
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), tracks },
    null,
    1,
  );
}

export async function importJson(text: string): Promise<number> {
  const parsed = JSON.parse(text) as { tracks?: Track[] };
  if (!Array.isArray(parsed.tracks)) throw new Error('Fichier illisible : pas de tableau `tracks`.');
  // Les audioId du fichier ne valent rien sur cet appareil : on garde ceux d'ici.
  const existing = new Map((await db.tracks.toArray()).map((t) => [t.id, t.audioId]));
  const merged = parsed.tracks.map((t) => ({ ...t, audioId: existing.get(t.id) ?? null }));
  await db.tracks.bulkPut(merged);
  return merged.length;
}
