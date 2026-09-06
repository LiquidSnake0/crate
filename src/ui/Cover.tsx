import { useEffect, useState } from 'react';
import { db, setCover } from '../db/db';
import type { Track } from '../model/types';
import { discOf, coverUrl } from '../model/types';

// Deux sources, dans cet ordre :
//  1. une image posee a la main ou lue dans un MP3, gardee en base ;
//  2. sinon la pochette publiee chez Bandcamp, pointee et non copiee.
//
// C'est le second cas qui fait que les pochettes apparaissent sur l'iPhone sans
// rien transporter : chaque origine a sa propre base IndexedDB, mais l'URL, elle,
// vaut partout.

const cache = new Map<string, string>();
const misses = new Set<string>();

async function storedUrl(discId: string): Promise<string | null> {
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
  const remote = coverUrl(track, size > 260 ? 'grande' : 'vignette');
  const [url, setUrl] = useState<string | null>(remote);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void storedUrl(disc).then((u) => {
      if (alive) setUrl(u ?? remote);
    });
    return () => {
      alive = false;
    };
  }, [disc, remote, tick]);

  const box = { width: size, height: size } as const;

  const image = url ? (
    <img
      className="cover-img"
      src={url}
      alt=""
      style={box}
      draggable={false}
      loading="lazy"
      // Hors ligne ou pochette retiree de Bandcamp : on retombe sur le disque muet.
      onError={() => setUrl(null)}
    />
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
