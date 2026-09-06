import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportJson, importJson } from '../db/db';
import { importFiles } from '../db/audio';
import type { Track, Family } from '../model/types';
import { FAMILIES, FAMILY_COLOR, FAMILY_INK, missingFields } from '../model/types';
import { deriveTag, tagConflict } from '../model/camelot';
import { useAudioSource } from '../audio/context';
import { TrackCard } from './TrackCard';
import { buildPlacements } from '../model/placement';
import { AddTrack } from './AddTrack';
import { Player } from './Player';

type FilterId = 'tous' | 'face' | 'famille' | 'cle' | 'divergent';
type SortId = 'disque' | 'couleur';

const FILTERS: { id: FilterId; label: string; match: (t: Track) => boolean }[] = [
  { id: 'tous', label: 'Tout', match: () => true },
  { id: 'face', label: 'Sans face', match: (t) => !t.side },
  { id: 'famille', label: 'Sans couleur', match: (t) => !t.family },
  { id: 'cle', label: 'Cle ou BPM manquant', match: (t) => !t.key || !t.bpm },
  {
    id: 'divergent',
    label: 'Tag divergent',
    match: (t) => tagConflict(t.legacyTag, deriveTag(t.key, t.bpm, t.anchorBpm)),
  },
];

const famRank = (f: Family | null) => (f ? FAMILIES.indexOf(f) : FAMILIES.length);

export function Library() {
  const tracks = useLiveQuery(() => db.tracks.toArray(), [], undefined);
  const { source, sources, setSourceId } = useAudioSource();
  const [filter, setFilter] = useState<FilterId>('tous');
  const [sort, setSort] = useState<SortId>('disque');
  const [family, setFamily] = useState<Family | null>(null);
  const [search, setSearch] = useState('');
  const [current, setCurrent] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const places = useMemo(() => buildPlacements(tracks ?? []), [tracks]);

  const sorted = useMemo(() => {
    if (!tracks) return [];
    const byDisc = (a: Track, b: Track) =>
      a.artist.localeCompare(b.artist) ||
      a.album.localeCompare(b.album) ||
      (a.trackNumber ?? 0) - (b.trackNumber ?? 0);
    // Par couleur : l'ordre des stickers, puis le disque a l'interieur.
    const byColor = (a: Track, b: Track) =>
      famRank(a.family) - famRank(b.family) || byDisc(a, b);
    return [...tracks].sort(sort === 'couleur' ? byColor : byDisc);
  }, [tracks, sort]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const q = search.trim().toLowerCase();
    return sorted.filter(
      (t) =>
        f.match(t) &&
        (!family || t.family === family) &&
        (!q ||
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)),
    );
  }, [sorted, filter, family, search]);

  const currentTrack = sorted.find((t) => t.id === current) ?? null;
  const playable = useMemo(
    () => visible.filter((t) => source.canPlay(t)),
    [visible, source],
  );

  const step = (delta: number) => {
    if (playable.length === 0) return;
    const i = playable.findIndex((t) => t.id === current);
    const next = playable[(i + delta + playable.length) % playable.length];
    setCurrent(next?.id ?? null);
  };

  if (!tracks) return <p className="loading">Ouverture du crate...</p>;

  const done = sorted.filter((t) => missingFields(t).length === 0).length;
  const counts = new Map<Family, number>();
  for (const t of sorted) if (t.family) counts.set(t.family, (counts.get(t.family) ?? 0) + 1);

  return (
    <div className="library">
      <header className="head">
        <div className="head-top">
          <h1>Crate</h1>
          <span className="progress">{done} / {sorted.length} complets</span>
        </div>

        <div className="actions">
          <button
            className={`action${adding ? ' action-on' : ''}`}
            onClick={() => setAdding((a) => !a)}
          >
            {adding ? 'Fermer la saisie' : 'Ajouter un morceau'}
          </button>

          <button
            className={`action${sort === 'couleur' ? ' action-on' : ''}`}
            onClick={() => setSort(sort === 'couleur' ? 'disque' : 'couleur')}
          >
            {sort === 'couleur' ? 'Classe par couleur' : 'Classe par disque'}
          </button>

          <select
            className="action"
            value={source.id}
            onChange={(e) => setSourceId(e.target.value)}
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

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
                  `${r.linked} fichiers rattaches, ${(r.bytes / 1e6).toFixed(0)} Mo, ` +
                    `${r.covers} pochettes lues.` +
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
            Exporter
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
                  setNotice(`${await importJson(await file.text())} morceaux restaures.`);
                } catch (err) {
                  setNotice(`Restauration impossible : ${(err as Error).message}`);
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>


      </header>

      <div className="sticky-bar">
        <input
          className="search"
          placeholder="Chercher un titre, un album, ou un sigle"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="colors">
          {FAMILIES.filter((f) => counts.has(f)).map((f) => (
            <button
              key={f}
              className={`swatch${family === f ? ' swatch-on' : ''}`}
              style={{ background: FAMILY_COLOR[f], color: FAMILY_INK[f] }}
              title={`${f} · ${counts.get(f)} morceaux`}
              aria-label={`${f}, ${counts.get(f)} morceaux`}
              onClick={() => setFamily(family === f ? null : f)}
            />
          ))}
          {family && (
            <button className="swatch swatch-clear" onClick={() => setFamily(null)}>
              tout
            </button>
          )}
        </div>

        <div className="filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`filter${filter === f.id ? ' filter-on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label} <b>{sorted.filter(f.match).length}</b>
            </button>
          ))}
        </div>

      </div>

      {notice && (
        <p className="notice" onClick={() => setNotice(null)}>{notice}</p>
      )}

      {adding && <AddTrack onDone={setNotice} />}

      <div className="list">
        {visible.map((t) => (
          <TrackCard
            key={t.id}
            track={t}
            code={places.get(t.id)?.code ?? ''}
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
