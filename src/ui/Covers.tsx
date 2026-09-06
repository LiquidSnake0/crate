import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setCover } from '../db/db';
import { importCovers, listDiscs, shrink } from '../db/covers';
import type { Track } from '../model/types';
import { forgetCover } from './Cover';

/**
 * Grille des disques. L'import en lot fait le gros, la grille finit le reste
 * a la main : sur 24 disques, une poignee ne se laissera pas deviner.
 */
export function Covers({ tracks, onDone }: { tracks: Track[]; onDone: (m: string) => void }) {
  const discs = useMemo(() => listDiscs(tracks), [tracks]);
  const covers = useLiveQuery(() => db.covers.toArray(), [], undefined);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const folderRef = useRef<HTMLInputElement>(null);

  const have = new Map((covers ?? []).map((c) => [c.id, c]));
  const missing = discs.filter((d) => !have.has(d.id)).length;

  const runImport = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const r = await importCovers(Array.from(files), tracks);
    for (const d of discs) forgetCover(d.id);
    setTick((t) => t + 1);
    setBusy(false);
    const s = (n: number) => (n > 1 ? 's' : '');
    onDone(
      `${r.matched} pochette${s(r.matched)} posee${s(r.matched)}` +
        (r.skipped ? `, ${r.skipped} laissee${s(r.skipped)} telle${s(r.skipped)} quelle${s(r.skipped)}` : '') +
        (r.unmatched.length
          ? `, ${r.unmatched.length} image${s(r.unmatched.length)} sans disque reconnu`
          : '') +
        '.',
    );
  };

  return (
    <div className="add">
      <p className="hint" style={{ margin: 0 }}>
        {discs.length} disques, <b>{missing}</b> sans pochette. Choisis le dossier ou
        sont tes albums : le nom du dossier sert a les reconnaitre.
      </p>

      <div className="actions" style={{ marginTop: 0 }}>
        <label className="action">
          {busy ? 'Import en cours...' : 'Choisir un dossier'}
          <input
            ref={folderRef}
            type="file"
            hidden
            multiple
            // @ts-expect-error attribut non standard, mais c'est le seul moyen
            // de recuperer le nom du dossier, qui porte le titre de l'album.
            webkitdirectory=""
            onChange={async (e) => {
              await runImport(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <label className="action">
          Choisir des images
          <input
            type="file"
            hidden
            multiple
            accept="image/*"
            onChange={async (e) => {
              await runImport(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="grid">
        {discs.map((d) => {
          const row = have.get(d.id);
          return (
            <label key={d.id} className="tile" title={`${d.artist} · ${d.album}`}>
              <DiscTile discId={d.id} tick={tick} />
              <span className="tile-name">{d.album}</span>
              <span className="tile-sub">
                {d.artist} · {d.tracks} morceau{d.tracks > 1 ? 'x' : ''}
                {row?.source === 'manuel' ? ' · pose a la main' : ''}
              </span>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  await setCover(d.id, await shrink(f), 'manuel');
                  forgetCover(d.id);
                  setTick((t) => t + 1);
                  e.target.value = '';
                }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function DiscTile({ discId, tick }: { discId: string; tick: number }) {
  const [url, setUrl] = useState<string | null>(null);

  // useEffect et pas useMemo : useMemo n'appelle jamais la fonction de nettoyage,
  // et chaque rendu fuirait une URL d'objet.
  useEffect(() => {
    let mine: string | null = null;
    let alive = true;
    void db.covers.get(discId).then((row) => {
      if (!alive) return;
      mine = row ? URL.createObjectURL(row.blob) : null;
      setUrl(mine);
    });
    return () => {
      alive = false;
      if (mine) URL.revokeObjectURL(mine);
    };
  }, [discId, tick]);
  return url ? (
    <img className="tile-img" src={url} alt="" draggable={false} />
  ) : (
    <span className="tile-img cover-empty" aria-hidden />
  );
}
