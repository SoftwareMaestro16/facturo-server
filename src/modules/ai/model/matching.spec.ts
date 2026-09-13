import { describe, expect, it } from 'vitest';

import { matchByName, normalizeName } from './matching';

const buyers = [
  { id: 'nord', name: 'Atelier Nord SRL' },
  { id: 'sud', name: 'Atelier Sud SRL' },
  { id: 'vita', name: '„Vita Farm” S.R.L.' },
];

describe('normalizeName', () => {
  it('ignores case, diacritics, quotes and legal forms', () => {
    expect(normalizeName('SRL „Țara Vinului”')).toBe('tara vinului');
    expect(normalizeName('ООО «Ромашка»')).toBe('ромашка');
  });
});

describe('matchByName', () => {
  it('matches an exact name regardless of legal form', () => {
    expect(matchByName(buyers, 'atelier nord')).toEqual({ kind: 'match', id: 'nord' });
  });

  it('matches a unique partial name', () => {
    expect(matchByName(buyers, 'Vita')).toEqual({ kind: 'match', id: 'vita' });
  });

  it('refuses to guess between two candidates', () => {
    expect(matchByName(buyers, 'Atelier')).toEqual({ kind: 'ambiguous' });
  });

  it('returns none for an unknown or too short name', () => {
    expect(matchByName(buyers, 'Moldcell')).toEqual({ kind: 'none' });
    expect(matchByName(buyers, 'SR')).toEqual({ kind: 'none' });
    expect(matchByName(buyers, null)).toEqual({ kind: 'none' });
  });
});
