import { describe, it, expect } from 'vitest';
import { deriveTag, shiftCamelot, suggestAnchor, parseKey, sliceOf } from './camelot';
import seed from '../data/seed.json';

describe('parseKey', () => {
  it('accepte les cles Camelot valides', () => {
    expect(parseKey('8B')).toEqual({ n: 8, letter: 'B' });
    expect(parseKey('12a')).toEqual({ n: 12, letter: 'A' });
  });
  it('rejette le reste', () => {
    expect(parseKey('13A')).toBeNull();
    expect(parseKey('0A')).toBeNull();
    expect(parseKey('Dbm')).toBeNull();
    expect(parseKey('')).toBeNull();
  });
});

describe('shiftCamelot', () => {
  it('avance d une quinte par demi-ton', () => {
    expect(shiftCamelot('8B', 1)).toBe('3B');
    expect(shiftCamelot('6A', 1)).toBe('1A');
    expect(shiftCamelot('2A', 2)).toBe('4A');
  });
  it('ne change jamais la lettre', () => {
    expect(shiftCamelot('5A', 3)).toMatch(/A$/);
    expect(shiftCamelot('5B', 3)).toMatch(/B$/);
  });
  it('boucle sur les douze positions', () => {
    expect(shiftCamelot('1A', 12)).toBe('1A');
    expect(shiftCamelot('1A', -1)).toBe('6A');
  });
});

describe('suggestAnchor', () => {
  it('laisse la jungle a son bpm natif', () => {
    expect(suggestAnchor(134)).toBe(134);
  });
  it('laisse le bpm natif quand il est deja dans la bande mediane', () => {
    expect(suggestAnchor(90.15)).toBe(90.15);
  });
  it('remonte un morceau lent au palier bas', () => {
    expect(suggestAnchor(76.87)).toBe(82);
  });
  it('abandonne quand aucun palier n est atteignable', () => {
    expect(suggestAnchor(52.27)).toBe(52.27);
  });
});

// Non-regression sur les donnees reelles du Sheet. Si cette suite casse,
// c'est la formule qui a bouge, pas les donnees.
describe('deriveTag contre le Sheet', () => {
  const rows = (seed as Array<{
    key: string | null; bpm: number | null; anchorBpm: number | null;
    legacyTag: string | null; title: string;
  }>).filter((r) => r.key && r.bpm && r.anchorBpm && r.legacyTag);

  it('couvre la quasi-totalite du crate', () => {
    expect(rows.length).toBeGreaterThan(240);
  });

  it('reproduit la cle Camelot de chaque tag saisi', () => {
    const wrong = rows.filter((r) => {
      const d = deriveTag(r.key, r.bpm, r.anchorBpm);
      const saisi = r.legacyTag!.replace(/^[↑↓•⚠★]/, '').replace(/!$/, '');
      return d?.camelot !== saisi;
    });
    expect(wrong.map((r) => r.title)).toEqual([]);
  });

  it('reproduit le prefixe et le point d exclamation', () => {
    const wrong = rows.filter((r) => {
      const d = deriveTag(r.key, r.bpm, r.anchorBpm);
      return d?.text !== r.legacyTag;
    });
    expect(wrong.map((r) => `${r.title}: ${r.legacyTag}`)).toEqual([]);
  });
});

describe('tranches et fader', () => {
  it('la fleche designe la tranche, pas la direction du fader', () => {
    // 76.87 monte vers 82 : pitch positif, mais tranche basse donc fleche vers le bas.
    const t = deriveTag('8B', 76.87, 82);
    expect(t?.prefix).toBe('↓');
    expect(t!.pitch).toBeGreaterThan(0);
  });

  it('marque le passage en fader etendu au-dela de 8 %', () => {
    expect(deriveTag('2A', 73.92, 82)?.extendedFader).toBe(true);
    expect(deriveTag('8B', 76.87, 82)?.extendedFader).toBe(false);
  });

  it('sort du fader au-dela de 16 %', () => {
    expect(sliceOf(71.27)).toBe('↓'); // +15,1 %, dernier jouable
    expect(sliceOf(70.08)).toBe('⚠'); // +17,0 %, hors fader
  });

  it('range les speciaux a part', () => {
    expect(sliceOf(134)).toBe('★');
  });
});

// La regle des tranches doit reproduire la colonne "BPM joue" du classeur.
describe('suggestAnchor contre le classeur', () => {
  const rows = (seed as Array<{ bpm: number | null; anchorBpm: number | null; title: string }>)
    .filter((r) => r.bpm && r.anchorBpm);

  it('couvre la quasi-totalite du crate', () => {
    expect(rows.length).toBeGreaterThan(240);
  });

  it('retrouve le bpm joue de chaque morceau', () => {
    const wrong = rows.filter(
      (r) => Math.abs(suggestAnchor(r.bpm!) - r.anchorBpm!) > 0.01,
    );
    expect(wrong.map((r) => `${r.title}: ${r.bpm} -> ${r.anchorBpm}`)).toEqual([]);
  });
});

describe('familles reprises des couleurs du classeur', () => {
  const rows = seed as Array<{ family: string | null }>;
  it('ne laisse que les morceaux sans donnees sans couleur', () => {
    expect(rows.filter((r) => !r.family).length).toBe(4);
  });
});
