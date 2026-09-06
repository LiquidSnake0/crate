import { describe, it, expect } from 'vitest';
import { matchDisc, listDiscs, type Disc } from './covers';
import type { Track } from '../model/types';

const t = (artist: string, album: string): Track => ({
  id: `${artist}|${album}|${Math.random()}`,
  artist, album, title: 'x', trackNumber: 1,
  key: null, bpm: null, anchorBpm: null, side: null, family: null, durationSec: null, artId: null, bcUrl: null, plIndex: null,
  legacyTag: null, notes: '', audioId: null,
});

const discs: Disc[] = listDiscs([
  t('Macroblank', '色あせたエコー'),
  t('Oblique Occasions', 'NOVA CULTURA'),
  t('haircuts for men', 'nothing special, nothing wonderful'),
  t('slowerpace 音楽', 'Barbershop Simulator II'),
]);

describe('matchDisc', () => {
  it('reconnait le disque au dossier, meme quand le fichier s appelle cover', () => {
    expect(matchDisc('Oblique Occasions - NOVA CULTURA/cover.jpg', discs)?.album)
      .toBe('NOVA CULTURA');
  });

  it('reconnait aussi sur le seul nom du fichier', () => {
    expect(matchDisc('nova cultura.png', discs)?.album).toBe('NOVA CULTURA');
  });

  it('ignore la casse, la ponctuation et les separateurs', () => {
    expect(matchDisc('haircuts_for_men__Nothing-Special-Nothing-Wonderful/folder.jpg', discs)?.artist)
      .toBe('haircuts for men');
  });

  it('gere les titres non latins', () => {
    expect(matchDisc('Macroblank/色あせたエコー/cover.jpg', discs)?.album).toBe('色あせたエコー');
  });

  it('ne devine pas quand rien ne correspond', () => {
    expect(matchDisc('DCIM/IMG_4821.jpg', discs)).toBeNull();
  });

  it('ne renvoie rien plutot que de choisir au hasard entre deux disques', () => {
    const ambigus = listDiscs([t('A', 'Live'), t('B', 'Live')]);
    expect(matchDisc('un dossier Live quelconque/cover.jpg', ambigus)).toBeNull();
  });

  it('departage deux disques homonymes par l artiste', () => {
    const homonymes = listDiscs([t('Alpha', 'Live'), t('Beta', 'Live')]);
    expect(matchDisc('Beta - Live/cover.jpg', homonymes)?.artist).toBe('Beta');
  });
});

describe('listDiscs', () => {
  it('compte les morceaux par disque', () => {
    const d = listDiscs([t('A', 'Un'), t('A', 'Un'), t('A', 'Deux')]);
    expect(d.map((x) => [x.album, x.tracks])).toEqual([['Deux', 1], ['Un', 2]]);
  });
});
