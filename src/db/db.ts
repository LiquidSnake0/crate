import Dexie, { type Table } from 'dexie';
import type { Track, AudioBlob, Judgement } from '../model/types';
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
  judgements!: Table<Judgement, string>;

  constructor() {
    super('crate');
    this.version(1).stores({
      tracks: 'id, artist, album, side, family, audioId',
      audio: 'id',
    });
    this.version(2).stores({
      tracks: 'id, artist, album, side, family, audioId',
      audio: 'id',
      judgements: 'id, fromId, toId, verdict',
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
 * Complete la base avec le seed sans jamais ecraser une correction.
 *
 * Sur une base vide, remplit tout. Sur une base deja travaillee, n'ecrit que
 * dans les champs restes vides et n'ajoute que les morceaux absents. Un seed
 * enrichi peut donc etre rejoue a tout moment : le travail fait a la main gagne
 * toujours sur la donnee importee.
 */
export async function seedIfEmpty(): Promise<{ added: number; filled: number }> {
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

  const existing = new Map((await db.tracks.toArray()).map((t) => [t.id, t]));
  const toWrite: Track[] = [];
  let added = 0;
  let filled = 0;

  for (const row of rows) {
    const cur = existing.get(row.id);
    if (!cur) {
      toWrite.push(row);
      added += 1;
      continue;
    }
    const merged: Track = {
      ...cur,
      key: cur.key ?? row.key,
      bpm: cur.bpm ?? row.bpm,
      anchorBpm: cur.anchorBpm ?? row.anchorBpm,
      side: cur.side ?? row.side,
      family: cur.family ?? row.family,
      legacyTag: cur.legacyTag ?? row.legacyTag,
    };
    if (JSON.stringify(merged) !== JSON.stringify(cur)) {
      toWrite.push(merged);
      filled += 1;
    }
  }

  if (toWrite.length > 0) await db.tracks.bulkPut(toWrite);
  return { added, filled };
}

export async function updateTrack(id: string, patch: Partial<Track>): Promise<void> {
  await db.tracks.update(id, patch);
}

/** Export sans les blobs : c'est le travail qu'on sauvegarde, pas la musique. */
export async function exportJson(): Promise<string> {
  const [tracks, judgements] = await Promise.all([
    db.tracks.toArray(),
    db.judgements.toArray(),
  ]);
  return JSON.stringify(
    { version: 2, exportedAt: new Date().toISOString(), tracks, judgements },
    null,
    1,
  );
}

/** Enregistre un jugement d'enchainement. Un nouveau verdict remplace l'ancien. */
export async function judge(
  fromId: string,
  toId: string,
  verdict: 'oui' | 'non',
  source: Judgement['source'],
): Promise<void> {
  await db.judgements.put({
    id: `${fromId}>${toId}`,
    fromId,
    toId,
    verdict,
    source,
    at: new Date().toISOString(),
  });
}

export async function unjudge(fromId: string, toId: string): Promise<void> {
  await db.judgements.delete(`${fromId}>${toId}`);
}

/** Ajoute un morceau saisi a la main. Renvoie null si un morceau identique existe. */
export async function addTrack(
  input: Pick<Track, 'artist' | 'album' | 'title' | 'trackNumber' | 'key' | 'bpm'> &
    Partial<Pick<Track, 'anchorBpm' | 'side' | 'family' | 'notes'>>,
): Promise<Track | null> {
  const id = trackId(input);
  if (await db.tracks.get(id)) return null;
  const track: Track = {
    id,
    artist: input.artist,
    album: input.album,
    title: input.title,
    trackNumber: input.trackNumber,
    key: input.key,
    bpm: input.bpm,
    anchorBpm: input.anchorBpm ?? null,
    side: input.side ?? null,
    family: input.family ?? null,
    legacyTag: null,
    notes: input.notes ?? '',
    audioId: null,
  };
  await db.tracks.put(track);
  return track;
}

export async function importJson(text: string): Promise<number> {
  const parsed = JSON.parse(text) as { tracks?: Track[]; judgements?: Judgement[] };
  if (!Array.isArray(parsed.tracks)) throw new Error('Fichier illisible : pas de tableau `tracks`.');
  // Les audioId du fichier ne valent rien sur cet appareil : on garde ceux d'ici.
  const existing = new Map((await db.tracks.toArray()).map((t) => [t.id, t.audioId]));
  const merged = parsed.tracks.map((t) => ({ ...t, audioId: existing.get(t.id) ?? null }));
  await db.tracks.bulkPut(merged);
  if (Array.isArray(parsed.judgements)) await db.judgements.bulkPut(parsed.judgements);
  return merged.length;
}
