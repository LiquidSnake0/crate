import Dexie, { type Table } from 'dexie';
import type { Track, AudioBlob, Judgement, Cover, LiveState } from '../model/types';
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
  covers!: Table<Cover, string>;
  state!: Table<LiveState, string>;

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
    this.version(3).stores({
      tracks: 'id, artist, album, side, family, audioId',
      audio: 'id',
      judgements: 'id, fromId, toId, verdict',
      covers: 'id',
    });
    this.version(4).stores({
      tracks: 'id, artist, album, side, family, audioId',
      audio: 'id',
      judgements: 'id, fromId, toId, verdict',
      covers: 'id',
      state: 'id',
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
  durationSec?: number | null;
  artId?: string | null;
  bcUrl?: string | null;
  plIndex?: number | null;
}

/**
 * Titres corriges dans le seed apres verification sur la playlist Bandcamp.
 *
 * L'identifiant d'un morceau contient son titre : sans cette table, corriger un
 * titre creerait un doublon au lieu de remplacer l'ancien, et les corrections
 * faites a la main sur l'ancien seraient perdues.
 */
const RENAMED: { from: string; to: string }[] = [
  {
    from: 'macroblank|エコーチャンバーパーティー|2|甘い苦味w',
    to: 'macroblank|エコーチャンバーパーティー|2|甘い苦味',
  },
  {
    from: "slowerpace 音楽|encardia '99|7|cosmos- beginner's guide",
    to: "slowerpace 音楽|encardia '99|7|cosmos: beginner's guide",
  },
];

async function applyRenames(seedRows: SeedRow[]): Promise<void> {
  for (const { from, to } of RENAMED) {
    const old = await db.tracks.get(from);
    if (!old) continue;
    const current = await db.tracks.get(to);
    // Le titre corrige vient du seed : reprendre celui de l'ancien reconduirait
    // la faute de frappe sous un nouvel identifiant.
    const fixed = seedRows.find((r) => trackId(r) === to);
    await db.tracks.put({
      ...old,
      ...(current ?? {}),
      id: to,
      title: fixed?.title ?? current?.title ?? old.title,
      trackNumber: fixed?.trackNumber ?? old.trackNumber,
    });
    await db.tracks.delete(from);
    for (const j of await db.judgements.where('fromId').equals(from).toArray()) {
      await db.judgements.delete(j.id);
      await db.judgements.put({ ...j, id: `${to}>${j.toId}`, fromId: to });
    }
    for (const j of await db.judgements.where('toId').equals(from).toArray()) {
      await db.judgements.delete(j.id);
      await db.judgements.put({ ...j, id: `${j.fromId}>${to}`, toId: to });
    }
  }
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
  const seedRows = seed as SeedRow[];
  await applyRenames(seedRows);

  const rows = seedRows.map((r) => ({
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
    durationSec: r.durationSec ?? null,
    artId: r.artId ?? null,
    bcUrl: r.bcUrl ?? null,
    plIndex: r.plIndex ?? null,
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
      durationSec: cur.durationSec ?? row.durationSec,
      artId: cur.artId ?? row.artId,
      bcUrl: cur.bcUrl ?? row.bcUrl,
      plIndex: cur.plIndex ?? row.plIndex,
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

/**
 * Export du travail. Il porte les pochettes mais jamais l'audio.
 *
 * L'audio pese un a deux Go et se retelecharge ; les pochettes pesent deux Mo
 * et ont coute une peche sur Bandcamp disque par disque. Sans elles dans le
 * fichier, changer d'appareil voudrait dire tout recommencer, et c'est
 * justement ce que l'export doit eviter.
 */
export async function exportJson(): Promise<string> {
  const [tracks, judgements, coverRows] = await Promise.all([
    db.tracks.toArray(),
    db.judgements.toArray(),
    db.covers.toArray(),
  ]);
  const covers = await Promise.all(
    coverRows.map(async (c) => ({
      id: c.id,
      source: c.source,
      data: await blobToDataUrl(c.blob),
    })),
  );
  return JSON.stringify(
    { version: 3, exportedAt: new Date().toISOString(), tracks, judgements, covers },
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

/** Pose une pochette sur tout le disque. Un choix manuel n'est jamais ecrase par l'ID3. */
export async function setCover(
  discId: string,
  blob: Blob,
  source: Cover['source'],
): Promise<boolean> {
  const existing = await db.covers.get(discId);
  if (existing?.source === 'manuel' && source === 'id3') return false;
  await db.covers.put({ id: discId, blob, source });
  return true;
}

export async function saveLiveState(s: Partial<Omit<LiveState, 'id'>>): Promise<void> {
  const current = await db.state.get('live');
  await db.state.put({
    id: 'live',
    currentId: null,
    chain: [],
    ramp: 1,
    ...current,
    ...s,
  });
}

export async function unjudge(fromId: string, toId: string): Promise<void> {
  await db.judgements.delete(`${fromId}>${toId}`);
}

/** Ajoute un morceau saisi a la main. Renvoie null si un morceau identique existe. */
export async function addTrack(
  input: Pick<Track, 'artist' | 'album' | 'title' | 'trackNumber' | 'key' | 'bpm'> &
    Partial<Pick<Track, 'anchorBpm' | 'side' | 'family' | 'notes' | 'durationSec' | 'artId' | 'bcUrl' | 'plIndex'>>,
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
    durationSec: input.durationSec ?? null,
    artId: input.artId ?? null,
    bcUrl: input.bcUrl ?? null,
    plIndex: input.plIndex ?? null,
    legacyTag: null,
    notes: input.notes ?? '',
    audioId: null,
  };
  await db.tracks.put(track);
  return track;
}

export interface ImportJsonReport {
  tracks: number;
  judgements: number;
  covers: number;
}

export async function importJson(text: string): Promise<ImportJsonReport> {
  const parsed = JSON.parse(text) as {
    tracks?: Track[];
    judgements?: Judgement[];
    covers?: { id: string; source: Cover['source']; data: string }[];
  };
  if (!Array.isArray(parsed.tracks)) throw new Error('Fichier illisible : pas de tableau `tracks`.');

  // Les audioId du fichier ne valent rien sur cet appareil : on garde ceux d'ici.
  const existing = new Map((await db.tracks.toArray()).map((t) => [t.id, t.audioId]));
  const merged = parsed.tracks.map((t) => ({ ...t, audioId: existing.get(t.id) ?? null }));
  await db.tracks.bulkPut(merged);

  if (Array.isArray(parsed.judgements)) await db.judgements.bulkPut(parsed.judgements);

  let covers = 0;
  for (const c of parsed.covers ?? []) {
    // Une pochette posee a la main sur cet appareil reste prioritaire.
    if (await setCover(c.id, await dataUrlToBlob(c.data), c.source)) covers += 1;
  }
  return { tracks: merged.length, judgements: parsed.judgements?.length ?? 0, covers };
}
