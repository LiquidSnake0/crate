import { useState } from 'react';
import type { Family, Side } from '../model/types';
import { SIDES, FAMILIES, FAMILY_COLOR, FAMILY_INK } from '../model/types';
import { deriveTag, suggestAnchor } from '../model/camelot';
import { addTrack } from '../db/db';

/**
 * Saisie d'un morceau. Le classeur n'est plus la source : tout nouvel achat
 * entre ici.
 *
 * Le tag se calcule pendant la frappe, donc on voit ce qu'on obtient avant
 * d'enregistrer. Album et artiste restent en place apres l'ajout : on saisit un
 * disque d'un bloc, pas un morceau isole.
 */
export function AddTrack({ onDone }: { onDone: (message: string) => void }) {
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [title, setTitle] = useState('');
  const [trackNumber, setTrackNumber] = useState('');
  const [key, setKey] = useState('');
  const [bpm, setBpm] = useState('');
  const [anchor, setAnchor] = useState('');
  const [side, setSide] = useState<Side | null>(null);
  const [family, setFamily] = useState<Family | null>(null);

  const bpmNum = Number(bpm.replace(',', '.'));
  const anchorNum = Number(anchor.replace(',', '.'));
  const validBpm = Number.isFinite(bpmNum) && bpmNum > 0 ? bpmNum : null;
  const validAnchor = Number.isFinite(anchorNum) && anchorNum > 0 ? anchorNum : null;
  const tag = deriveTag(key || null, validBpm, validAnchor);
  const ready = artist.trim() && album.trim() && title.trim();

  const submit = async () => {
    if (!ready) return;
    const n = Number(trackNumber);
    const created = await addTrack({
      artist: artist.trim(),
      album: album.trim(),
      title: title.trim(),
      trackNumber: Number.isFinite(n) && n > 0 ? n : null,
      key: key.trim().toUpperCase() || null,
      bpm: validBpm,
      anchorBpm: validAnchor,
      side,
      family,
    });
    if (!created) {
      onDone(`"${title.trim()}" existe deja dans ce disque.`);
      return;
    }
    onDone(`"${created.title}" ajoute${tag ? ` en ${tag.text}` : ''}.`);
    // On enchaine sur la face suivante du meme disque.
    setTitle('');
    setKey('');
    setBpm('');
    setAnchor('');
    setTrackNumber(trackNumber && Number.isFinite(n) ? String(n + 1) : '');
  };

  return (
    <div className="add">
      <div className="field-row">
        <label className="field">
          <span>Artiste</span>
          <input value={artist} onChange={(e) => setArtist(e.target.value)} />
        </label>
        <label className="field">
          <span>Album</span>
          <input value={album} onChange={(e) => setAlbum(e.target.value)} />
        </label>
      </div>

      <div className="field-row">
        <label className="field field-grow">
          <span>Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field field-narrow">
          <span>Piste</span>
          <input
            inputMode="numeric"
            value={trackNumber}
            onChange={(e) => setTrackNumber(e.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Cle</span>
          <input
            placeholder="8B"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
          />
        </label>
        <label className="field">
          <span>BPM</span>
          <input inputMode="decimal" value={bpm} onChange={(e) => setBpm(e.target.value)} />
        </label>
        <label className="field">
          <span>BPM joue</span>
          <input
            inputMode="decimal"
            placeholder={validBpm ? String(suggestAnchor(validBpm)) : ''}
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
          />
        </label>
      </div>

      <div className="chip-row">
        <span className="chip-label">Face</span>
        {SIDES.map((s) => (
          <button
            key={s}
            className={`chip${side === s ? ' chip-on' : ''}`}
            onClick={() => setSide(side === s ? null : s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="chip-row">
        <span className="chip-label">Couleur</span>
        {FAMILIES.map((f) => (
          <button
            key={f}
            className={`swatch${family === f ? ' swatch-on' : ''}`}
            style={{ background: FAMILY_COLOR[f], color: FAMILY_INK[f] }}
            onClick={() => setFamily(family === f ? null : f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="editor-foot">
        <span className="derived">
          {tag
            ? `${tag.text} · tranche ${tag.prefix === '⚠' ? 'hors fader' : tag.prefix}` +
              (tag.extendedFader ? ' · passer en ±16' : '')
            : 'cle et BPM pour voir le tag'}
        </span>
        <button className="play" disabled={!ready} onClick={() => void submit()}>
          Ajouter
        </button>
      </div>
    </div>
  );
}
