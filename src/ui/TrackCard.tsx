import { useState } from 'react';
import type { Track, Family, Side } from '../model/types';
import { SIDES, PICKABLE_FAMILIES, FAMILY_COLOR, FAMILY_INK, missingFields } from '../model/types';
import { deriveTag, tagConflict, suggestAnchor } from '../model/camelot';
import { updateTrack } from '../db/db';
import { useAudioSource } from '../audio/context';
import { Cover } from './Cover';
import { BandcampLinkSource } from '../audio/bandcamp';

interface Props {
  track: Track;
  /** Sigle face + rang sur la face, ex "B4". Vide tant que la face manque. */
  code: string;
  playing: boolean;
  onPlay: (t: Track) => void;
}

/**
 * Une carte = un morceau corrigeable. Chaque champ ecrit dans IndexedDB des la
 * sortie du champ : pas de bouton Enregistrer, rien a perdre si Safari tue
 * l'onglet au milieu d'une session de tri.
 */
const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function TrackCard({ track, code, playing, onPlay }: Props) {
  const [open, setOpen] = useState(false);
  const { source } = useAudioSource();
  const tag = deriveTag(track.key, track.bpm, track.anchorBpm);
  const conflict = tagConflict(track.legacyTag, tag);
  const missing = missingFields(track);
  const fam = track.family;

  const set = (patch: Partial<Track>) => void updateTrack(track.id, patch);

  // Le genre n'a pas de colonne : il est porte par la couleur du tag, comme
  // dans le classeur et sur les stickers.
  const tagStyle = fam
    ? { background: FAMILY_COLOR[fam], color: FAMILY_INK[fam] }
    : { background: 'transparent', color: 'var(--line)', border: '1px dashed var(--line)' };

  return (
    <article className={`card${playing ? ' card-playing' : ''}`}>
      <div className="card-head" onClick={() => setOpen((o) => !o)}>
        <Cover track={track} size={52} />
        <span className={code ? 'code' : 'code code-empty'}>{code || '··'}</span>
        <div className="card-id">
          <span className={`tag${conflict ? ' tag-conflict' : ''}`} style={tagStyle}>
            {tag ? tag.text : '?'}
          </span>
          <span className="row-title">{track.title}</span>
          <span className="row-sub">
            {track.artist} · {track.album}
            {track.durationSec ? ` · ${fmt(track.durationSec)}` : ''}
          </span>
        </div>
      </div>

      {missing.length > 0 && !open && (
        <button className="missing" onClick={() => setOpen(true)}>
          manque : {missing.join(', ')}
        </button>
      )}

      {conflict && (
        <p className="conflict-note">
          Le classeur disait <b>{track.legacyTag}</b>, le calcul dit <b>{tag?.text}</b>.
          Un des trois champs cle, bpm ou bpm joue est faux.
        </p>
      )}

      {open && (
        <div className="editor">
          <div className="field-row">
            <label className="field">
              <span>Cle</span>
              <input
                inputMode="text"
                placeholder="8B"
                defaultValue={track.key ?? ''}
                onBlur={(e) => set({ key: e.target.value.trim().toUpperCase() || null })}
              />
            </label>
            <label className="field">
              <span>BPM</span>
              <input
                inputMode="decimal"
                placeholder="86.4"
                defaultValue={track.bpm ?? ''}
                onBlur={(e) => {
                  const v = Number(e.target.value.replace(',', '.'));
                  set({ bpm: Number.isFinite(v) && v > 0 ? v : null });
                }}
              />
            </label>
            <label className="field">
              <span>BPM joue</span>
              <input
                inputMode="decimal"
                placeholder={track.bpm ? String(suggestAnchor(track.bpm)) : '82'}
                defaultValue={track.anchorBpm ?? ''}
                onBlur={(e) => {
                  const v = Number(e.target.value.replace(',', '.'));
                  set({ anchorBpm: Number.isFinite(v) && v > 0 ? v : null });
                }}
              />
            </label>
          </div>

          <div className="chip-row">
            <span className="chip-label">Face</span>
            {SIDES.map((s: Side) => (
              <button
                key={s}
                className={`chip${track.side === s ? ' chip-on' : ''}`}
                onClick={() => set({ side: track.side === s ? null : s })}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="chip-row">
            <span className="chip-label">Couleur</span>
            {PICKABLE_FAMILIES.map((f: Family) => (
              <button
                key={f}
                className={`swatch${fam === f ? ' swatch-on' : ''}`}
                style={{ background: FAMILY_COLOR[f] }}
                title={f}
                aria-label={f}
                onClick={() => set({ family: fam === f ? null : f })}
              />
            ))}
          </div>

          <div className="chip-row">
            <span className="chip-label">Pochette</span>
            <Cover track={track} size={44} editable />
            <span className="hint-inline">vaut pour tout le disque</span>
          </div>

          <label className="field field-wide">
            <span>Note</span>
            <input
              defaultValue={track.notes}
              placeholder="intro longue, fin abrupte, ..."
              onBlur={(e) => set({ notes: e.target.value })}
            />
          </label>

          <div className="editor-foot">
            {tag && (
              <span className="derived">
                tranche {tag.prefix === '⚠' ? 'hors fader' : tag.prefix}
                {' · '}
                {tag.semitones >= 0 ? '+' : ''}{tag.semitones} demi-ton{Math.abs(tag.semitones) > 1 ? 's' : ''}
                {' · '}pitch {(tag.pitch * 100).toFixed(1)} %
                {tag.extendedFader && ' · passer en ±16'}
              </span>
            )}
            {track.bcUrl || source instanceof BandcampLinkSource ? (
              <a
                className="play"
                href={
                  track.bcUrl ??
                  (source instanceof BandcampLinkSource
                    ? source.searchUrl(track)
                    : `https://bandcamp.com/search?q=${encodeURIComponent(`${track.artist} ${track.title}`)}`)
                }
                target="_blank"
                rel="noreferrer"
              >
                Bandcamp ↗
              </a>
            ) : (
              <button
                className="play"
                disabled={!source.canPlay(track)}
                onClick={() => onPlay(track)}
              >
                {source.canPlay(track) ? 'Ecouter' : source.unavailableLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
