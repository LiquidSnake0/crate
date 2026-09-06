import { useState } from 'react';
import type { Track, Family, Side } from '../model/types';
import { SIDES, FAMILIES, FAMILY_COLOR, missingFields } from '../model/types';
import { deriveTag, tagConflict, suggestAnchor } from '../model/camelot';
import { updateTrack } from '../db/db';

interface Props {
  track: Track;
  playing: boolean;
  onPlay: (t: Track) => void;
}

/**
 * Une carte = un morceau corrigeable. Chaque champ ecrit dans IndexedDB
 * des la sortie du champ : pas de bouton Enregistrer, rien a perdre si
 * Safari tue l'onglet au milieu d'une session de tri.
 */
export function TrackCard({ track, playing, onPlay }: Props) {
  const [open, setOpen] = useState(false);
  const tag = deriveTag(track.key, track.bpm, track.anchorBpm);
  const conflict = tagConflict(track.legacyTag, tag);
  const missing = missingFields(track);

  const set = (patch: Partial<Track>) => void updateTrack(track.id, patch);

  return (
    <article className={`card${playing ? ' card-playing' : ''}`}>
      <div className="card-head" onClick={() => setOpen((o) => !o)}>
        <div className="card-id">
          <span className="track-title">{track.title}</span>
          <span className="track-sub">
            {track.artist} · {track.album}
            {track.trackNumber ? ` · ${track.trackNumber}` : ''}
          </span>
        </div>
        <div className="card-badges">
          {track.family && (
            <span className="pill" style={{ background: FAMILY_COLOR[track.family] }}>
              {track.family}
            </span>
          )}
          {track.side && <span className="pill pill-side">{track.side}</span>}
          {tag ? (
            <span className={`tag${conflict ? ' tag-conflict' : ''}`}>{tag.text}</span>
          ) : (
            <span className="tag tag-empty">?</span>
          )}
        </div>
      </div>

      {missing.length > 0 && !open && (
        <button className="missing" onClick={() => setOpen(true)}>
          manque : {missing.join(', ')}
        </button>
      )}

      {conflict && (
        <p className="conflict-note">
          Le Sheet disait <b>{track.legacyTag}</b>, le calcul dit <b>{tag?.text}</b>.
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
            <span className="chip-label">Famille</span>
            {FAMILIES.map((f: Family) => (
              <button
                key={f}
                className={`chip${track.family === f ? ' chip-on' : ''}`}
                style={track.family === f ? { background: FAMILY_COLOR[f], color: '#111', borderColor: FAMILY_COLOR[f] } : undefined}
                onClick={() => set({ family: track.family === f ? null : f })}
              >
                {f}
              </button>
            ))}
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
                {tag.semitones >= 0 ? '+' : ''}{tag.semitones} demi-ton
                {Math.abs(tag.semitones) > 1 ? 's' : ''} · pitch {(tag.pitch * 100).toFixed(1)} %
              </span>
            )}
            <button
              className="play"
              disabled={!track.audioId}
              onClick={() => onPlay(track)}
            >
              {track.audioId ? 'Ecouter' : 'Pas de fichier'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
