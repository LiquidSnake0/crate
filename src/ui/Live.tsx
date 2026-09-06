import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, judge, unjudge } from '../db/db';
import type { Track } from '../model/types';
import { FAMILY_COLOR, FAMILY_INK } from '../model/types';
import { deriveTag } from '../model/camelot';
import { rankNext, playedBpm, pairKey, DEFAULT_WEIGHTS, type Weights } from '../model/scoring';

/**
 * Mode live : on tape le morceau en cours, l'app classe les suites possibles.
 *
 * Le tempo cible monte a chaque enchainement, c'est la rampe du set. Un pas de
 * 1 BPM mene de 82 a 97 en dix-sept morceaux, soit une heure de set.
 */
export function Live() {
  const tracks = useLiveQuery(() => db.tracks.toArray(), [], undefined);
  const rows = useLiveQuery(() => db.judgements.toArray(), [], undefined);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [search, setSearch] = useState('');
  const [chain, setChain] = useState<string[]>([]);
  const [showRefused, setShowRefused] = useState(false);

  const verdicts = useMemo(
    () => new Map((rows ?? []).map((j) => [j.id, j.verdict])),
    [rows],
  );

  const current = tracks?.find((t) => t.id === currentId) ?? null;

  // Un refus sort de la vue : c'est le but. Il reste consultable pour etre annule.
  const ranked = useMemo(() => {
    if (!current || !tracks) return [];
    return rankNext(current, tracks, { weights, verdicts });
  }, [current, tracks, weights, verdicts]);

  const refused = useMemo(() => ranked.filter((c) => c.verdict === 'non'), [ranked]);
  // Annuler le dernier refus ramene a la liste, sinon on reste sur du vide.
  const viewingRefused = showRefused && refused.length > 0;
  const candidates = viewingRefused
    ? refused
    : ranked.filter((c) => c.verdict !== 'non').slice(0, 40);

  if (!tracks) return <p className="loading">Ouverture du crate...</p>;

  // Pas de morceau en cours : on choisit par quoi on demarre.
  if (!current) {
    const q = search.trim().toLowerCase();
    const found = q
      ? tracks
          .filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.artist.toLowerCase().includes(q) ||
              t.album.toLowerCase().includes(q),
          )
          .slice(0, 25)
      : [];
    return (
      <div className="live">
        <p className="live-hint">Par quoi tu demarres ?</p>
        <input
          className="search"
          autoFocus
          placeholder="Titre, artiste ou album"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="list">
          {found.map((t) => (
            <button key={t.id} className="pick" onClick={() => { setCurrentId(t.id); setChain([t.id]); }}>
              <TagChip track={t} />
              <span className="pick-id">
                <b>{t.title}</b>
                <span>{t.artist} · {t.album}</span>
              </span>
              <span className="pick-bpm">{playedBpm(t) ?? '?'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const from = playedBpm(current);
  const target = (from ?? 82) + weights.ramp;

  const advance = (t: Track) => {
    void judge(current.id, t.id, 'oui', 'live');
    setCurrentId(t.id);
    setChain((c) => [...c, t.id]);
  };

  return (
    <div className="live">
      <div className="now">
        <TagChip track={current} big />
        <div className="now-id">
          <b>{current.title}</b>
          <span>{current.artist} · {current.album}{current.side ? ` · face ${current.side}` : ''}</span>
        </div>
        <button className="now-change" onClick={() => setCurrentId(null)}>changer</button>
      </div>

      <div className="ramp">
        <span className="ramp-line">
          {from ?? '?'} BPM <span className="ramp-arrow">→</span> <b>{target.toFixed(1)}</b> vise
          <span className="ramp-count"> · {chain.length} morceau{chain.length > 1 ? 'x' : ''}</span>
        </span>
        {refused.length > 0 && (
          <button
            className={`ramp-refused${viewingRefused ? ' ramp-refused-on' : ''}`}
            onClick={() => setShowRefused((v) => !v)}
          >
            {refused.length} refuse{refused.length > 1 ? 's' : ''}
          </button>
        )}
        <label className="ramp-field">
          <span>BPM par morceau</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={weights.ramp}
            onChange={(e) => setWeights({ ...weights, ramp: Number(e.target.value) })}
          />
          <b>{weights.ramp.toFixed(1)}</b>
        </label>
      </div>

      <div className="list">
        {candidates.map((c) => {
          const key = pairKey(current, c.track);
          const verdict = verdicts.get(key) ?? null;
          return (
            <article key={c.track.id} className={`cand${verdict ? ` cand-${verdict}` : ''}`}>
              <TagChip track={c.track} />
              <div className="cand-id" onClick={() => advance(c.track)}>
                <b>{c.track.title}</b>
                <span>
                  {c.track.artist} · {c.bpm ?? '?'} BPM
                  {verdict && <em> · deja juge {verdict}</em>}
                </span>
                <span className="cand-why">
                  tempo {pct(c.tempo)} · couleur {pct(c.color)} · cle {pct(c.camelot)}
                </span>
              </div>
              <span className="cand-score">{Math.round(c.score * 100)}</span>
              <div className="cand-vote">
                <button
                  className={verdict === 'oui' ? 'vote vote-on' : 'vote'}
                  title="Ca passe"
                  onClick={() =>
                    verdict === 'oui'
                      ? void unjudge(current.id, c.track.id)
                      : void judge(current.id, c.track.id, 'oui', 'ecoute')
                  }
                >
                  ✓
                </button>
                <button
                  className={verdict === 'non' ? 'vote vote-on vote-no' : 'vote'}
                  title="Ca passe pas"
                  onClick={() =>
                    verdict === 'non'
                      ? void unjudge(current.id, c.track.id)
                      : void judge(current.id, c.track.id, 'non', 'ecoute')
                  }
                >
                  ✗
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}`;

function TagChip({ track, big }: { track: Track; big?: boolean }) {
  const tag = deriveTag(track.key, track.bpm, track.anchorBpm);
  const fam = track.family;
  return (
    <span
      className={big ? 'player-tag' : 'tag'}
      style={
        fam
          ? { background: FAMILY_COLOR[fam], color: FAMILY_INK[fam] }
          : { border: '1px dashed var(--line)', color: 'var(--muted)' }
      }
    >
      {tag ? tag.text : '?'}
    </span>
  );
}
