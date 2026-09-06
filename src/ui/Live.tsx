import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, judge, unjudge, saveLiveState } from '../db/db';
import type { Track } from '../model/types';
import { FAMILY_COLOR, FAMILY_INK, PLAYLIST_URL, externalLink } from '../model/types';
import { deriveTag } from '../model/camelot';
import { buildPlacements } from '../model/placement';
import {
  rankNext, playedBpm, averageDuration, rampPlan,
  DEFAULT_WEIGHTS, type Weights,
} from '../model/scoring';
import { Cover } from './Cover';

/**
 * Page Bandcamp du morceau. **Elle s'ouvre dans le navigateur, jamais dans l'app.**
 *
 * Bandcamp ne declare que deux chemins comme liens universels, dans son
 * `apple-app-site-association` : `/*​/playlist/*` et `/redirect_to_app`. Les pages
 * `/track/` et `/album/` n'en font pas partie, donc iOS ne les detourne pas vers
 * l'app, quoi qu'on fasse. En echange, c'est un seul geste pour ecouter.
 *
 * La recherche ne sert que pour un morceau saisi a la main, sans lien connu.
 */
function bandcampUrl(t: Track): string {
  return t.bcUrl ?? `https://bandcamp.com/search?q=${encodeURIComponent(`${t.artist} ${t.title}`)}`;
}

/**
 * Mode live : on tape le morceau en cours, l'app classe les suites.
 *
 * Ce qui identifie un candidat, c'est la pochette et le sigle "B4". Le titre est
 * present mais discret : aux platines, il ne sert pas a retrouver un disque.
 *
 * Le tempo cible monte a chaque enchainement, c'est la rampe du set.
 */
export function Live() {
  const tracks = useLiveQuery(() => db.tracks.toArray(), [], undefined);
  const rows = useLiveQuery(() => db.judgements.toArray(), [], undefined);
  // `get` rend undefined aussi bien pendant le chargement que quand rien n'est
  // enregistre : impossible de distinguer les deux, et la restauration ne
  // s'achevait donc jamais au premier lancement. Un tableau leve l'ambiguite.
  const saved = useLiveQuery(() => db.state.where('id').equals('live').toArray(), [], undefined);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [search, setSearch] = useState('');
  const [chain, setChain] = useState<string[]>([]);
  const [showRefused, setShowRefused] = useState(false);
  const [restored, setRestored] = useState(false);
  const [setMinutes, setSetMinutes] = useState(60);

  // On reprend le set la ou il en etait, une seule fois : Selim ecoute dans
  // Bandcamp et revient, et iOS a pu decharger la webapp entre-temps.
  useEffect(() => {
    if (restored || saved === undefined) return;
    const row = saved[0];
    if (row) {
      setCurrentId(row.currentId);
      setChain(row.chain);
      setWeights((w) => ({ ...w, ramp: row.ramp }));
      if (row.setMinutes) setSetMinutes(row.setMinutes);
    }
    setRestored(true);
  }, [saved, restored]);

  useEffect(() => {
    if (!restored) return;
    void saveLiveState({ currentId, chain, ramp: weights.ramp, setMinutes });
  }, [restored, currentId, chain, weights.ramp, setMinutes]);

  const verdicts = useMemo(
    () => new Map((rows ?? []).map((j) => [j.id, j.verdict])),
    [rows],
  );
  const places = useMemo(() => buildPlacements(tracks ?? []), [tracks]);
  const code = (t: Track) => places.get(t.id)?.code ?? '';

  const current = tracks?.find((t) => t.id === currentId) ?? null;

  const avg = useMemo(() => averageDuration(tracks ?? []), [tracks]);

  // Temps deja joue : la somme des durees de la chaine, pas une horloge. Selim
  // peut poser le telephone entre deux disques sans fausser le plan.
  const playedSec = useMemo(() => {
    if (!tracks) return 0;
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return chain.reduce((s, id) => s + (byId.get(id)?.durationSec ?? avg), 0);
  }, [chain, tracks, avg]);

  const plan = useMemo(
    () => rampPlan(playedBpm(current ?? ({} as Track)) ?? 82, playedSec, setMinutes, avg),
    [current, playedSec, setMinutes, avg],
  );

  const effective = useMemo<Weights>(() => ({ ...weights, ramp: plan.step }), [weights, plan.step]);

  const ranked = useMemo(() => {
    if (!current || !tracks) return [];
    return rankNext(current, tracks, { weights: effective, verdicts });
  }, [current, tracks, effective, verdicts]);

  const refused = useMemo(() => ranked.filter((c) => c.verdict === 'non'), [ranked]);
  // Annuler le dernier refus ramene a la liste, sinon on reste sur du vide.
  const viewingRefused = showRefused && refused.length > 0;
  const candidates = viewingRefused
    ? refused
    : ranked.filter((c) => c.verdict !== 'non').slice(0, 40);

  if (!tracks) return <p className="loading">Ouverture du crate...</p>;

  if (!current) {
    const q = search.trim().toLowerCase();
    const found = q
      ? tracks
          .filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.artist.toLowerCase().includes(q) ||
              t.album.toLowerCase().includes(q) ||
              code(t).toLowerCase() === q,
          )
          .slice(0, 25)
      : [];
    return (
      <div className="pad">
        <p className="hint">Par quoi tu demarres ?</p>
        <input
          className="search"
          autoFocus
          placeholder="Titre, album, ou un sigle comme B4"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="list">
          {found.map((t) => (
            <button
              key={t.id}
              className="row row-tap"
              onClick={() => {
                setCurrentId(t.id);
                setChain([t.id]);
              }}
            >
              <Cover track={t} size={52} />
              <span className={code(t) ? 'code' : 'code code-empty'}>{code(t) || '··'}</span>
              <span className="row-id">
                <span className="row-title">{t.title}</span>
                <span className="row-sub">{t.album}</span>
              </span>
              <span className="row-bpm">{playedBpm(t) ?? '?'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const from = playedBpm(current);
  const target = (from ?? 82) + plan.step;
  const mmss = (sec: number) =>
    `${Math.floor(sec / 60)}\u2009min`;
  const currentTag = deriveTag(current.key, current.bpm, current.anchorBpm);

  const advance = (t: Track) => {
    void judge(current.id, t.id, 'oui', 'live');
    setCurrentId(t.id);
    setChain((c) => [...c, t.id]);
  };

  return (
    <div className="pad">
      <div className="now">
        <Cover track={current} size={72} />
        <div className="now-id">
          <span className="now-code">{code(current) || '··'}</span>
          <span
            className="tag"
            style={
              current.family
                ? { background: FAMILY_COLOR[current.family], color: FAMILY_INK[current.family] }
                : { border: '1px dashed var(--line)', color: 'var(--muted)' }
            }
          >
            {currentTag ? currentTag.text : '?'}
          </span>
          <span className="now-title">{current.title}</span>
        </div>
        <div className="now-actions">
          <a className="ghost ghost-link" href={bandcampUrl(current)} {...externalLink()}>
            Ecouter ↗
          </a>
          {/* Le seul lien que l'app Bandcamp intercepte sur iOS. */}
          <a className="ghost ghost-link" href={PLAYLIST_URL} {...externalLink()}>
            App{current.plIndex ? ` · n°${current.plIndex}` : ''}
          </a>
          <button className="ghost" onClick={() => setCurrentId(null)}>
            changer
          </button>
        </div>
      </div>

      <div className="ramp">
        <span className="ramp-line">
          {from ?? '?'} <span className="ramp-arrow">→</span> <b>{target.toFixed(1)}</b> BPM
          <span className="ramp-count">
            {' · '}+{plan.step.toFixed(1)} par morceau · {mmss(playedSec)} sur {setMinutes}
            {' · reste ~'}{plan.remainingTracks}
          </span>
        </span>
        {refused.length > 0 && (
          <button
            className={`ghost${viewingRefused ? ' ghost-warn' : ''}`}
            onClick={() => setShowRefused((v) => !v)}
          >
            {refused.length} refuse{refused.length > 1 ? 's' : ''}
          </button>
        )}
        <label className="ramp-field" title="Duree du set">
          <input
            type="range"
            min="30"
            max="240"
            step="15"
            value={setMinutes}
            onChange={(e) => setSetMinutes(Number(e.target.value))}
          />
          <b>{setMinutes >= 60 ? `${(setMinutes / 60).toFixed(setMinutes % 60 ? 1 : 0)} h` : `${setMinutes} min`}</b>
        </label>
      </div>

      <div className="list">
        {candidates.map((c) => {
          const t = c.track;
          const verdict = c.verdict;
          const tag = deriveTag(t.key, t.bpm, t.anchorBpm);
          return (
            <article key={t.id} className={`row${verdict === 'non' ? ' row-off' : ''}`}>
              <button className="row-main" onClick={() => advance(t)}>
                <Cover track={t} size={56} />
                <span className={code(t) ? 'code' : 'code code-empty'}>{code(t) || '··'}</span>
                <span className="row-id">
                  <span
                    className="tag"
                    style={
                      t.family
                        ? { background: FAMILY_COLOR[t.family], color: FAMILY_INK[t.family] }
                        : { border: '1px dashed var(--line)', color: 'var(--muted)' }
                    }
                  >
                    {tag ? tag.text : '?'}
                  </span>
                  <span className="row-title">{t.title}</span>
                  <span className="row-why">
                    {c.bpm ?? '?'} BPM · tempo {Math.round(c.tempo * 100)} · couleur{' '}
                    {Math.round(c.color * 100)} · cle {Math.round(c.camelot * 100)}
                    {t.plIndex ? ` · n°${t.plIndex}` : ''}
                  </span>
                </span>
                <span className="row-score">{Math.round(c.score * 100)}</span>
              </button>
              <div className="votes">
                <a
                  className="vote vote-link"
                  href={bandcampUrl(t)}
                  {...externalLink()}
                  aria-label="Ecouter sur Bandcamp"
                  title={`Ecouter sur Bandcamp${t.plIndex ? ` · n°${t.plIndex} de la playlist` : ''}`}
                >
                  ↗
                </a>
                <button
                  className={verdict === 'oui' ? 'vote vote-yes' : 'vote'}
                  aria-label="Ca passe"
                  onClick={() =>
                    verdict === 'oui'
                      ? void unjudge(current.id, t.id)
                      : void judge(current.id, t.id, 'oui', 'ecoute')
                  }
                >
                  ✓
                </button>
                <button
                  className={verdict === 'non' ? 'vote vote-no' : 'vote'}
                  aria-label="Ca passe pas"
                  onClick={() =>
                    verdict === 'non'
                      ? void unjudge(current.id, t.id)
                      : void judge(current.id, t.id, 'non', 'ecoute')
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
