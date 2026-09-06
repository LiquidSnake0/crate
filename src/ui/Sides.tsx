import { useMemo, useState } from 'react';
import { db } from '../db/db';
import type { Track } from '../model/types';
import { discOf } from '../model/types';
import { planSides, suggestCuts, applySides } from '../model/sides';
import { Cover } from './Cover';

/**
 * Poser les faces d'un disque.
 *
 * L'ordre affiche est celui du numero de piste, verifie identique a celui de la
 * playlist Bandcamp sur les onze disques concernes. Il ne reste donc qu'a dire ou
 * la face change : une a trois coupures par disque au lieu de cent treize saisies.
 */
export function Sides({ tracks, onDone }: { tracks: Track[]; onDone: (m: string) => void }) {
  const discs = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (const t of tracks) {
      const k = discOf(t);
      const l = map.get(k);
      if (l) l.push(t);
      else map.set(k, [t]);
    }
    return [...map.entries()]
      .map(([id, list]) => ({
        id,
        list: [...list].sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0)),
      }))
      .filter((d) => d.list.some((t) => !t.side))
      .sort((a, b) => a.list[0].album.localeCompare(b.list[0].album));
  }, [tracks]);

  const [open, setOpen] = useState<string | null>(null);

  if (discs.length === 0) {
    return (
      <div className="add">
        <p className="hint" style={{ margin: 0 }}>Tous les disques ont leurs faces.</p>
      </div>
    );
  }

  return (
    <div className="add">
      <p className="hint" style={{ margin: 0 }}>
        <b>{discs.length}</b> disques sans faces. L'ordre est celui de ta playlist :
        pose seulement les coupures.
      </p>
      {discs.map((d) => (
        <DiscSides
          key={d.id}
          list={d.list}
          open={open === d.id}
          onToggle={() => setOpen(open === d.id ? null : d.id)}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

function DiscSides({
  list, open, onToggle, onDone,
}: {
  list: Track[];
  open: boolean;
  onToggle: () => void;
  onDone: (m: string) => void;
}) {
  const [cuts, setCuts] = useState<number[]>([]);
  const plans = useMemo(() => planSides(list, cuts), [list, cuts]);
  const head = list[0];
  const mins = (s: number) => `${Math.round(s / 60)} min`;

  const toggleCut = (i: number) =>
    setCuts((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i].sort((a, b) => a - b)));

  const save = async () => {
    const rows = applySides(plans);
    await db.transaction('rw', db.tracks, async () => {
      for (const r of rows) await db.tracks.update(r.id, { side: r.side, trackNumber: r.trackNumber });
    });
    onDone(`${head.album} : ${plans.length} faces posees sur ${rows.length} morceaux.`);
  };

  return (
    <div className="disc-sides">
      <button className="disc-head" onClick={onToggle}>
        <Cover track={head} size={40} />
        <span className="row-id">
          <span className="row-title">{head.album}</span>
          <span className="row-sub">
            {head.artist} · {list.length} pistes ·{' '}
            {mins(list.reduce((s, t) => s + (t.durationSec ?? 0), 0))}
          </span>
        </span>
        <span className="ghost">{open ? 'fermer' : 'decouper'}</span>
      </button>

      {open && (
        <>
          <div className="cut-actions">
            <button className="action" onClick={() => setCuts(suggestCuts(list, 2))}>2 faces</button>
            <button className="action" onClick={() => setCuts(suggestCuts(list, 4))}>4 faces</button>
            <button className="action" onClick={() => setCuts([])}>tout enlever</button>
            <span className="hint-inline">
              {plans.map((p) => `${p.side} ${mins(p.seconds)}`).join(' · ')}
            </span>
          </div>

          <ol className="cut-list">
            {list.map((t, i) => {
              const plan = plans.find((p) => p.tracks.includes(t));
              const pos = plan ? plan.tracks.indexOf(t) + 1 : i + 1;
              return (
                <li key={t.id}>
                  <div className="cut-row">
                    <span className="code">{plan ? `${plan.side}${pos}` : '··'}</span>
                    <span className="row-title">{t.title}</span>
                    <span className="row-sub">
                      {t.durationSec
                        ? `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')}`
                        : ''}
                    </span>
                  </div>
                  {i < list.length - 1 && (
                    <button
                      className={`cut${cuts.includes(i) ? ' cut-on' : ''}`}
                      onClick={() => toggleCut(i)}
                    >
                      {cuts.includes(i) ? 'changement de face' : 'couper ici'}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="editor-foot">
            <span className="derived">{plans.length} faces</span>
            <button className="play" onClick={() => void save()}>Enregistrer</button>
          </div>
        </>
      )}
    </div>
  );
}
