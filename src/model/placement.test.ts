import { describe, it, expect } from 'vitest';
import { buildPlacements } from './placement';
import type { Track } from './types';

const t = (p: Partial<Track>): Track => ({
  id: p.id ?? Math.random().toString(36).slice(2),
  artist: p.artist ?? 'A', album: p.album ?? 'Alb', title: p.title ?? 'T',
  trackNumber: p.trackNumber ?? null, key: null, bpm: null, anchorBpm: null,
  side: p.side ?? null, family: null, durationSec: null, legacyTag: null, notes: '', audioId: null,
  ...p,
});

describe('buildPlacements', () => {
  it('repart a 1 a chaque face', () => {
    const rows = [
      t({ id: 'a1', side: 'A', trackNumber: 1 }),
      t({ id: 'a2', side: 'A', trackNumber: 2 }),
      t({ id: 'b1', side: 'B', trackNumber: 3 }),
      t({ id: 'b2', side: 'B', trackNumber: 4 }),
    ];
    const p = buildPlacements(rows);
    expect(p.get('a1')?.code).toBe('A1');
    expect(p.get('a2')?.code).toBe('A2');
    expect(p.get('b1')?.code).toBe('B1');
    expect(p.get('b2')?.code).toBe('B2');
  });

  it('ordonne par numero de piste, pas par ordre d arrivee', () => {
    const rows = [
      t({ id: 'second', side: 'A', trackNumber: 9 }),
      t({ id: 'premier', side: 'A', trackNumber: 2 }),
    ];
    const p = buildPlacements(rows);
    expect(p.get('premier')?.code).toBe('A1');
    expect(p.get('second')?.code).toBe('A2');
  });

  it('numerote chaque disque independamment', () => {
    const rows = [
      t({ id: 'x', album: 'Un', side: 'A', trackNumber: 1 }),
      t({ id: 'y', album: 'Deux', side: 'A', trackNumber: 1 }),
    ];
    const p = buildPlacements(rows);
    expect(p.get('x')?.code).toBe('A1');
    expect(p.get('y')?.code).toBe('A1');
  });

  it('laisse un sigle vide tant que la face manque', () => {
    const p = buildPlacements([t({ id: 'sans', side: null })]);
    expect(p.get('sans')).toEqual({ code: '', index: null });
  });
});
