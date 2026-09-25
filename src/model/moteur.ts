// Le lien du crate vers emotion-calculator : trois commandes, un fetch chacune.
//
// LE CRATE DIT QUEL DISQUE, JAMAIS SUR QUELLE VOIE. Il envoie la fiche du disque cale au
// casque (/deck/cue), dit quand il passe en salle (/deck/take), ou pose directement ce qui
// joue (/deck/play). Le moteur, lui, sait sur quelle voie de la table le cue se trouve.
//
// Ce qui part est la fiche TELLE QU'ELLE SE JOUE : le BPM d'ancrage et la cle transposee,
// pas les valeurs natives — sur une platine le disque tourne au pitch, et c'est ce que
// le moteur entend. C'est la carte « /deck recoit le BPM joue et la cle transposee ».
//
// L'adresse du moteur est celle de l'ordinateur sur le reseau du moment (au studio, le
// partage de connexion du telephone) : elle se regle a l'ecran et reste dans ce navigateur.
import type { Track } from './types';
import { FAMILY_COLOR, coverUrl } from './types';
import { deriveTag } from './camelot';

const CLE_URL = 'crate:moteur';

export function moteurUrl(): string {
  try {
    const v = localStorage.getItem(CLE_URL);
    if (v) return v;
  } catch { /* stockage indisponible : on retombe sur l'hote de la page */ }
  return `http://${location.hostname}:5099`;
}

export function setMoteurUrl(url: string): void {
  try { localStorage.setItem(CLE_URL, url.trim().replace(/\/+$/, '')); } catch { /* idem */ }
}

/** Ce que le moteur attend sur /deck/cue et /deck/play : son TrackContext. */
export interface Fiche {
  title: string;
  disc: string;
  side: string;
  camelot: string;
  family: string;
  colorHex: string;
  coverUrl: string | null;
  bpm: number;
}

export function fiche(t: Track): Fiche {
  const tag = deriveTag(t.key, t.bpm, t.anchorBpm);
  return {
    title: t.title,
    disc: t.album,
    side: t.side ?? '',
    camelot: tag?.camelot ?? t.key ?? '',
    family: t.family ?? '',
    colorHex: t.family ? FAMILY_COLOR[t.family] : '#6E6E6E',
    coverUrl: coverUrl(t, 'grande'),
    bpm: t.anchorBpm ?? t.bpm ?? 0,
  };
}

export interface Reponse {
  ok: boolean;
  status: number;
  quoi: string;
  at: string;
}

async function poster(chemin: string, corps?: unknown): Promise<Reponse> {
  const quoi = chemin.replace('/deck/', '');
  const at = new Date().toISOString();
  try {
    const r = await fetch(`${moteurUrl()}${chemin}`, {
      method: 'POST',
      headers: corps === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    return { ok: r.ok, status: r.status, quoi, at };
  } catch {
    // Le moteur n'est pas la, ou pas joignable : on le dit, on ne bloque pas le DJ.
    return { ok: false, status: 0, quoi, at };
  }
}

export const envoyerCue = (t: Track) => poster('/deck/cue', fiche(t));
export const envoyerPlay = (t: Track) => poster('/deck/play', fiche(t));
export const envoyerTake = () => poster('/deck/take');
