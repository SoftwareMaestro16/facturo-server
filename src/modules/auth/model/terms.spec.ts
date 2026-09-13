import { describe, expect, it } from 'vitest';

import { CURRENT_TERMS_VERSION, isCurrentTermsVersion, needsTermsRecord } from './terms';

describe('terms acceptance', () => {
  it('accepts only the edition currently published', () => {
    expect(isCurrentTermsVersion(CURRENT_TERMS_VERSION)).toBe(true);
    expect(isCurrentTermsVersion('2020-01-01')).toBe(false);
    expect(isCurrentTermsVersion(undefined)).toBe(false);
  });

  it('records a first or a newer acceptance, but keeps an existing one', () => {
    expect(needsTermsRecord(null)).toBe(true);
    expect(needsTermsRecord('2020-01-01')).toBe(true);
    expect(needsTermsRecord(CURRENT_TERMS_VERSION)).toBe(false);
  });
});
