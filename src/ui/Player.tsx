import { useEffect, useRef, useState } from 'react';
import type { Track } from '../model/types';
import { audioUrl } from '../db/audio';
import { deriveTag } from '../model/camelot';

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    if (!track?.audioId) {
      setUrl(null);
      return;
    }
    void audioUrl(track.audioId).then((u) => {
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      revoked = u;
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [track?.audioId]);

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

  return (
    <div className="player">
      <div className="player-id">
        <span className="player-title">{track.title}</span>
        <span className="player-sub">
          {track.artist}
          {track.side ? ` · face ${track.side}` : ''}
          {tag ? ` · ${tag.text}` : ''}
        </span>
      </div>
      <div className="player-controls">
        <button onClick={onPrev} aria-label="Precedent">◀</button>
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
        <button onClick={onNext} aria-label="Suivant">▶</button>
      </div>
      <audio
        ref={audioRef}
        src={url ?? undefined}
        autoPlay
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={onNext}
      />
      {!url && <span className="player-warn">fichier absent</span>}
    </div>
  );
}
