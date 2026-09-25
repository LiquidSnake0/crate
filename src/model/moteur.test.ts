import { describe, expect, it } from 'vitest';
import { fiche } from './moteur';
import type { Track } from './types';

const base: Track = {
  id: 'x', artist: 'GORE', album: 'Pistolero Viajero', title: 'El Diablo Viste de Cuero',
  trackNumber: 7, key: '2A', bpm: 97.67, anchorBpm: 92, side: null, family: null,
  durationSec: 338, artId: '3637701583', bcUrl: null, plIndex: 7, legacyTag: null,
  notes: '', audioId: null,
};

describe('la fiche envoyee au moteur', () => {
  it('porte le BPM joue et la cle transposee, pas les valeurs natives', () => {
    const f = fiche(base);
    expect(f.bpm).toBe(92);
    // 97,67 → 92 = −5,8 %, un demi-ton vers le bas : 2A recule de sept crans, 7A.
    expect(f.camelot).toBe('7A');
    expect(f.disc).toBe('Pistolero Viajero');
    expect(f.coverUrl).toContain('3637701583');
  });

  it('sans famille, la couleur est le gris neutre du moteur', () => {
    expect(fiche(base).colorHex).toBe('#6E6E6E');
    expect(fiche(base).family).toBe('');
  });

  it('avec une famille, la couleur du sticker', () => {
    const f = fiche({ ...base, family: 'M-' });
    expect(f.family).toBe('M-');
    expect(f.colorHex).toBe('#7FB3D5');
  });

  it('sans ancrage, le BPM natif ; sans cle, une cle vide', () => {
    const f = fiche({ ...base, anchorBpm: null, key: null });
    expect(f.bpm).toBe(97.67);
    expect(f.camelot).toBe('');
  });
});
