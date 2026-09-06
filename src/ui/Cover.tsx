import { useEffect, useState } from 'react';
import { db, setCover } from '../db/db';
import type { Track } from '../model/types';
import { discOf } from '../model/types';

// Les URL d'objet sont mises en cache par disque : sans cela, une liste de
// quarante candidats en recreerait quarante a chaque rendu et les fuirait.
const cache = new Map<string, string>();
const misses = new Set<string>();

async function coverUrl(discId: string): Promise<string | null> {
  const hit = cache.get(discId);
  if (hit) return hit;
  if (misses.has(discId)) return null;
  const row = await db.covers.get(discId);
  if (!row) {
    misses.add(discId);
    return null;
  }
  const url = URL.createObjectURL(row.blob);
  cache.set(discId, url);
  return url;
}

/** A appeler quand une pochette change, sinon l'ancienne reste affichee. */
export function forgetCover(discId: string): void {
  const url = cache.get(discId);
  if (url) URL.revokeObjectURL(url);
  cache.delete(discId);
  misses.delete(discId);
}

interface Props {
  track: Track;
  size: number;
  /** Autorise le remplacement de la pochette par un fichier choisi a la main. */
  editable?: boolean;
}

export function Cover({ track, size, editable }: Props) {
  const disc = discOf(track);
  const [url, setUrl] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void coverUrl(disc).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [disc, tick]);

  const box = { width: size, height: size } as const;

  // Sans pochette, un disque muet plutot que deux lettres d'album : le titre
  // ne sert pas a reconnaitre, et deux lettres tronquees encore moins.
  const image = url ? (
    <img className="cover-img" src={url} alt="" style={box} draggable={false} />
  ) : (
    <span className="cover-empty" style={box} aria-hidden />
  );

  if (!editable) return image;

  return (
    <label className="cover-edit" style={box} title="Changer la pochette du disque">
      {image}
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await setCover(disc, file, 'manuel');
          forgetCover(disc);
          setTick((t) => t + 1);
          e.target.value = '';
        }}
      />
    </label>
  );
}
