import { describe, it, expect } from 'vitest';
import {
  colorFactor, camelotFactor, tempoFactor, rankNext, pairKey, DEFAULT_WEIGHTS,
  rampPlan, averageDuration,
} from './scoring';
import type { Track } from './types';

const make = (p: Partial<Track>): Track => ({
  id: p.id ?? Math.random().toString(36).slice(2),
  artist: p.artist ?? 'A', album: p.album ?? 'Alb', title: p.title ?? 'T',
  trackNumber: null, key: p.key ?? '8A', bpm: p.bpm ?? 82,
  anchorBpm: p.anchorBpm ?? null, side: null, family: p.family ?? 'M',
  durationSec: p.durationSec ?? null, legacyTag: null, notes: '', audioId: null, ...p,
});

describe('tempoFactor', () => {
  it('donne son maximum au tempo cible', () => {
    expect(tempoFactor(83, 83)).toBe(1);
    expect(tempoFactor(84, 83)).toBeLessThan(1);
  });
  it('reste strictement ordonne meme sous le pas de rampe', () => {
    // Un pas de 0,1 BPM doit rester lisible : pas de palier.
    expect(tempoFactor(82.1, 82.1)).toBeGreaterThan(tempoFactor(82.2, 82.1));
  });
  it('est symetrique', () => {
    expect(tempoFactor(80, 83)).toBeCloseTo(tempoFactor(86, 83));
  });
  it('decroit avec l ecart', () => {
    expect(tempoFactor(86, 83)).toBeLessThan(tempoFactor(84, 83));
    expect(tempoFactor(97, 83)).toBeLessThan(tempoFactor(86, 83));
  });
});

describe('colorFactor', () => {
  it('favorise la meme couleur', () => {
    expect(colorFactor('M', 'M')).toBe(1);
  });
  it('accepte le cran voisin de la meme voie', () => {
    expect(colorFactor('M', 'M+')).toBeGreaterThan(colorFactor('M', 'B+'));
  });
  it('isole les speciaux du reste du crate', () => {
    expect(colorFactor('M', 'S')).toBeLessThan(0.1);
    expect(colorFactor('S', 'S')).toBe(1);
  });
  it('ne penalise pas une couleur inconnue', () => {
    expect(colorFactor(null, 'M')).toBe(0.5);
  });
});

describe('camelotFactor', () => {
  it('classe la meme cle en tete', () => {
    expect(camelotFactor('8A', '8A')).toBe(1);
  });
  it('accepte le voisin et la relative', () => {
    expect(camelotFactor('8A', '9A')).toBeGreaterThan(0.8);
    expect(camelotFactor('8A', '8B')).toBeGreaterThan(0.8);
  });
  it('boucle sur la roue', () => {
    expect(camelotFactor('12A', '1A')).toBe(camelotFactor('1A', '12A'));
    expect(camelotFactor('12A', '1A')).toBeGreaterThan(0.8);
  });
  it('ecarte les cles eloignees', () => {
    expect(camelotFactor('8A', '2A')).toBeLessThan(0.2);
  });
});

describe('rankNext', () => {
  const current = make({ id: 'cur', album: 'Disque 1', key: '8A', anchorBpm: 82, family: 'M' });

  it('exclut les autres faces du meme disque', () => {
    const same = make({ id: 'x', artist: 'A', album: 'Disque 1' });
    const other = make({ id: 'y', artist: 'A', album: 'Disque 2' });
    const ids = rankNext(current, [same, other], { weights: DEFAULT_WEIGHTS }).map((c) => c.track.id);
    expect(ids).toEqual(['y']);
  });

  it('vise le tempo suivant sur la rampe, pas le tempo courant', () => {
    const pile = make({ id: 'pile', album: 'D2', anchorBpm: 82 });
    const monte = make({ id: 'monte', album: 'D3', anchorBpm: 83 });
    const [first] = rankNext(current, [pile, monte], { weights: DEFAULT_WEIGHTS });
    expect(first.track.id).toBe('monte');
  });

  it('suit le pas de rampe qu on lui donne', () => {
    const lent = make({ id: 'lent', album: 'D2', anchorBpm: 82.1 });
    const rapide = make({ id: 'rapide', album: 'D3', anchorBpm: 83 });
    const doux = rankNext(current, [lent, rapide], {
      weights: { ...DEFAULT_WEIGHTS, ramp: 0.1 },
    });
    expect(doux[0].track.id).toBe('lent');
  });

  it('un verdict rendu domine le calcul', () => {
    const mauvais = make({ id: 'bad', album: 'D2', anchorBpm: 130, family: 'S', key: '2A' });
    const bon = make({ id: 'good', album: 'D3', anchorBpm: 83, family: 'M', key: '8A' });
    const verdicts = new Map([
      [pairKey(current, mauvais), 'oui' as const],
      [pairKey(current, bon), 'non' as const],
    ]);
    const ranked = rankNext(current, [mauvais, bon], { weights: DEFAULT_WEIGHTS, verdicts });
    expect(ranked[0].track.id).toBe('bad');
    expect(ranked[ranked.length - 1].track.id).toBe('good');
  });

  it('ne juge pas un morceau sur une donnee absente', () => {
    const sansCle = make({ id: 'nk', album: 'D2', key: null, anchorBpm: 83 });
    const [c] = rankNext(current, [sansCle], { weights: DEFAULT_WEIGHTS });
    expect(c.score).toBeGreaterThan(0);
  });
});

describe('rampPlan', () => {
  const AVG = 285; // moyenne reelle du crate

  it('retrouve la regle du +1 BPM sur un set d une heure', () => {
    const p = rampPlan(82, 0, 60, AVG);
    expect(p.remainingTracks).toBe(13);
    expect(p.step).toBeCloseTo(1.15, 1);
  });

  it('etale la montee sur un set plus long', () => {
    expect(rampPlan(82, 0, 180, AVG).step).toBeLessThan(rampPlan(82, 0, 60, AVG).step);
  });

  it('accelere quand le set avance sans que le tempo ait suivi', () => {
    const debut = rampPlan(82, 0, 60, AVG);
    const tard = rampPlan(82, 45 * 60, 60, AVG);
    expect(tard.step).toBeGreaterThan(debut.step);
  });

  it('ne redescend jamais une fois en haut', () => {
    expect(rampPlan(97, 0, 60, AVG).step).toBe(0);
    expect(rampPlan(105, 0, 60, AVG).step).toBe(0);
  });

  it('tient sans planter quand le set est fini', () => {
    const p = rampPlan(90, 99999, 60, AVG);
    expect(p.remainingSec).toBe(0);
    expect(p.remainingTracks).toBe(1);
    expect(Number.isFinite(p.step)).toBe(true);
  });
});

describe('averageDuration', () => {
  it('ignore les morceaux sans duree', () => {
    const rows = [make({ durationSec: 200 }), make({ durationSec: null }), make({ durationSec: 400 })];
    expect(averageDuration(rows)).toBe(300);
  });
  it('se rabat sur la moyenne du crate quand rien n est connu', () => {
    expect(averageDuration([make({ durationSec: null })])).toBe(285);
  });
});
