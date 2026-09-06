import { describe, it, expect } from 'vitest';
import { planSides, suggestCuts, applySides } from './sides';
import type { Track } from './types';

const t = (id: string, sec: number): Track => ({
  id, artist: 'A', album: 'Alb', title: id, trackNumber: null,
  key: null, bpm: null, anchorBpm: null, side: null, family: null,
  durationSec: sec, legacyTag: null, notes: '', audioId: null,
});

const six = [t('1', 300), t('2', 300), t('3', 300), t('4', 300), t('5', 300), t('6', 300)];

describe('planSides', () => {
  it('sans coupure, tout tient sur la face A', () => {
    const p = planSides(six, []);
    expect(p).toHaveLength(1);
    expect(p[0].side).toBe('A');
    expect(p[0].tracks).toHaveLength(6);
  });

  it('coupe en deux faces au bon endroit', () => {
    const p = planSides(six, [2]);
    expect(p.map((x) => [x.side, x.tracks.length])).toEqual([['A', 3], ['B', 3]]);
  });

  it('additionne la duree de chaque face', () => {
    expect(planSides(six, [2])[0].seconds).toBe(900);
  });

  it('accepte quatre faces', () => {
    expect(planSides(six, [0, 2, 4]).map((x) => x.side)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('ignore une coupure hors bornes ou en double', () => {
    expect(planSides(six, [2, 2, 99, -1])).toHaveLength(2);
  });

  it('ne depasse jamais quatre faces', () => {
    expect(planSides(six, [0, 1, 2, 3, 4]).length).toBeLessThanOrEqual(4);
  });
});

describe('suggestCuts', () => {
  it('coupe au milieu quand les durees sont egales', () => {
    expect(suggestCuts(six, 2)).toEqual([2]);
  });

  it('suit la duree et non le nombre de pistes', () => {
    // Un premier morceau tres long doit faire tomber la coupure tout de suite.
    const rows = [t('long', 1800), t('a', 60), t('b', 60), t('c', 60)];
    expect(suggestCuts(rows, 2)).toEqual([0]);
  });

  it('se rabat sur le nombre de pistes sans duree connue', () => {
    const rows = [t('a', 0), t('b', 0), t('c', 0), t('d', 0)];
    expect(suggestCuts(rows, 2)).toEqual([1]);
  });

  it('ne propose rien pour une seule face', () => {
    expect(suggestCuts(six, 1)).toEqual([]);
  });
});

describe('applySides', () => {
  it('renumerote a partir de 1 sur chaque face', () => {
    expect(applySides(planSides(six, [2]))).toEqual([
      { id: '1', side: 'A', trackNumber: 1 },
      { id: '2', side: 'A', trackNumber: 2 },
      { id: '3', side: 'A', trackNumber: 3 },
      { id: '4', side: 'B', trackNumber: 1 },
      { id: '5', side: 'B', trackNumber: 2 },
      { id: '6', side: 'B', trackNumber: 3 },
    ]);
  });
});
