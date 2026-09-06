import { useEffect, useRef, useState } from 'react';
import type { Track } from '../model/types';
import { FAMILY_COLOR, FAMILY_INK } from '../model/types';
import { deriveTag } from '../model/camelot';
import { useAudioSource } from '../audio/context';

interface Props {
  track: Track | null;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * L'enchainement part de l'evenement `ended` de l'element audio, jamais d'un
 * timer : Safari suspend le JS quand l'ecran se verrouille, mais laisse passer
 * les evenements media. C'est la seule facon de tenir en poche.
 */
export function Player({ track, onNext, onPrev }: Props) {
  const { source } = useAudioSource();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let mine: string | null = null;
    let cancelled = false;
    if (!track) {
      setUrl(null);
      return;
    }
    void source.resolve(track).then((u) => {
      if (cancelled) {
        if (u) source.release(u);
        return;
      }
      mine = u;
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (mine) source.release(mine);
    };
  }, [track, source]);

  useEffect(() => {
    if (!track || !('mediaSession' in navigator)) return;
    const tag = deriveTag(track.key, track.bpm, track.anchorBpm);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: `${track.album}${track.side ? ` · face ${track.side}` : ''}${tag ? ` · ${tag.text}` : ''}`,
    });
    navigator.mediaSession.setActionHandler('nexttrack', onNext);
    navigator.mediaSession.setActionHandler('previoustrack', onPrev);
    return () => {
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
    };
  }, [track, onNext, onPrev]);

  if (!track) return null;
  const tag = deriveTag(track.key, track.bpm, track.anchorBpm);
  const fam = track.family;

  return (
    <div className="player">
      {tag && (
        <span
          className="player-tag"
          style={
            fam
              ? { background: FAMILY_COLOR[fam], color: FAMILY_INK[fam] }
              : { border: '1px dashed var(--line)', color: 'var(--muted)' }
          }
        >
          {tag.text}
        </span>
      )}
      <div className="player-id">
        <span className="player-title">{track.title}</span>
        <span className="player-sub">
          {track.artist}
          {track.side ? ` · face ${track.side}` : ''}
          {track.anchorBpm ? ` · ${track.anchorBpm} BPM` : ''}
        </span>
      </div>
      <div className="player-controls">
        <button onClick={onPrev} aria-label="Precedent">◀◀</button>
        <button
          className="player-main"
          onClick={() => {
            const a = audioRef.current;
            if (!a) return;
            if (a.paused) void a.play();
            else a.pause();
          }}
          aria-label={playing ? 'Pause' : 'Lecture'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button onClick={onNext} aria-label="Suivant">▶▶</button>
      </div>
      <audio
        ref={audioRef}
        src={url ?? undefined}
        autoPlay
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={onNext}
      />
    </div>
  );
}
