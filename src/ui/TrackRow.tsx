import type { Track } from '../model/types';
import { FAMILY_COLOR, FAMILY_INK } from '../model/types';
import { deriveTag } from '../model/camelot';
import { Cover } from './Cover';

/**
 * L'identite d'un morceau, dans l'ordre ou Selim le reconnait : la pochette,
 * puis le sigle face + rang sur la face ("B4"), puis le tag. Le titre passe
 * apres : en live il ne lui sert pas.
 */
export function TrackRow({
  track,
  code,
  coverSize = 52,
  editableCover,
}: {
  track: Track;
  code: string;
  coverSize?: number;
  editableCover?: boolean;
}) {
  const tag = deriveTag(track.key, track.bpm, track.anchorBpm);
  const fam = track.family;

  return (
    <>
      <Cover track={track} size={coverSize} editable={editableCover} />
      <span className={code ? 'code' : 'code code-empty'}>{code || '··'}</span>
      <span className="row-id">
        <span
          className="tag"
          style={
            fam
              ? { background: FAMILY_COLOR[fam], color: FAMILY_INK[fam] }
              : { border: '1px dashed var(--line)', color: 'var(--muted)' }
          }
        >
          {tag ? tag.text : '?'}
        </span>
        <span className="row-title">{track.title}</span>
        <span className="row-sub">
          {track.artist} · {track.album}
        </span>
      </span>
    </>
  );
}
