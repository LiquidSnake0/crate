import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportJson, importJson } from '../db/db';
import { importFiles } from '../db/audio';
import type { Track } from '../model/types';
import { missingFields } from '../model/types';
import { deriveTag, tagConflict } from '../model/camelot';
import { TrackCard } from './TrackCard';
import { Player } from './Player';

type FilterId = 'tous' | 'face' | 'famille' | 'cle' | 'divergent' | 'fichier';

const FILTERS: { id: FilterId; label: string; match: (t: Track) => boolean }[] = [
  { id: 'tous', label: 'Tout', match: () => true },
  { id: 'face', label: 'Sans face', match: (t) => !t.side },
  { id: 'famille', label: 'Sans famille', match: (t) => !t.family },
  { id: 'cle', label: 'Cle ou BPM manquant', match: (t) => !t.key || !t.bpm },
  {
    id: 'divergent',
    label: 'Tag divergent',
    match: (t) => tagConflict(t.legacyTag, deriveTag(t.key, t.bpm, t.anchorBpm)),
  },
  { id: 'fichier', label: 'Sans fichier', match: (t) => !t.audioId },
];

export function Library() {
  const tracks = useLiveQuery(() => db.tracks.toArray(), [], undefined);
  const [filter, setFilter] = useState<FilterId>('tous');
  const [search, setSearch] = useState('');
  const [current, setCurrent] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!tracks) return [];
    return [...tracks].sort(
      (a, b) =>
        a.artist.localeCompare(b.artist) ||
        a.album.localeCompare(b.album) ||
        (a.trackNumber ?? 0) - (b.trackNumber ?? 0),
    );
  }, [tracks]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const q = search.trim().toLowerCase();
    return sorted.filter(
      (t) =>
        f.match(t) &&
        (!q ||
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)),
    );
  }, [sorted, filter, search]);

  const currentTrack = sorted.find((t) => t.id === current) ?? null;
  const playable = useMemo(() => visible.filter((t) => t.audioId), [visible]);

  const step = (delta: number) => {
    if (playable.length === 0) return;
    const i = playable.findIndex((t) => t.id === current);
    const next = playable[(i + delta + playable.length) % playable.length];
    setCurrent(next?.id ?? null);
  };

  if (!tracks) return <p className="loading">Ouverture du crate...</p>;

  const done = sorted.filter((t) => missingFields(t).length === 0).length;

  return (
    <div className="library">
      <header className="head">
        <div className="head-top">
          <h1>Crate</h1>
          <span className="progress">
            {done} / {sorted.length} complets
          </span>
        </div>
        <input
          className="search"
          placeholder="Chercher un titre, un artiste, un album"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filters">
          {FILTERS.map((f) => {
            const n = sorted.filter(f.match).length;
            return (
              <button
                key={f.id}
                className={`filter${filter === f.id ? ' filter-on' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label} <b>{n}</b>
              </button>
            );
          })}
        </div>
        <div className="actions">
          <label className="action">
            Importer des MP3
            <input
              type="file"
              accept="audio/mpeg,.mp3"
              multiple
              hidden
              onChange={async (e) => {
                const files = e.target.files;
                if (!files?.length) return;
                setNotice('Import en cours...');
                const r = await importFiles(files);
                setNotice(
                  `${r.linked} fichiers rattaches, ${(r.bytes / 1e6).toFixed(0)} Mo.` +
                    (r.unmatched.length
                      ? ` ${r.unmatched.length} sans correspondance dans le crate.`
                      : ''),
                );
                e.target.value = '';
              }}
            />
          </label>
          <button
            className="action"
            onClick={async () => {
              const text = await exportJson();
              const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = `crate-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Exporter mon travail
          </button>
          <label className="action">
            Restaurer
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const n = await importJson(await file.text());
                  setNotice(`${n} morceaux restaures.`);
                } catch (err) {
                  setNotice(`Restauration impossible : ${(err as Error).message}`);
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {notice && (
          <p className="notice" onClick={() => setNotice(null)}>
            {notice}
          </p>
        )}
      </header>

      <div className="list">
        {visible.map((t) => (
          <TrackCard
            key={t.id}
            track={t}
            playing={t.id === current}
            onPlay={(x) => setCurrent(x.id)}
          />
        ))}
        {visible.length === 0 && <p className="empty">Rien ici. Filtre suivant.</p>}
      </div>

      <Player track={currentTrack} onNext={() => step(1)} onPrev={() => step(-1)} />
    </div>
  );
}
