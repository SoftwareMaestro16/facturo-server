import { describe, expect, it } from 'vitest';

import { explain, listExplanations } from './error-catalogue';

describe('e-Factura error catalogue', () => {
  it('gives both interface languages for every entry', () => {
    for (const entry of listExplanations()) {
      expect(entry.ro.length).toBeGreaterThan(0);
      expect(entry.ru.length).toBeGreaterThan(0);
    }
  });

  it('falls back to an honest sentence instead of leaking a raw code', () => {
    const unknown = explain('SOME_SFS_CODE_WE_HAVE_NOT_SEEN');

    expect(unknown.code).toBe('efactura_unknown_error');
    expect(unknown.ro).not.toContain('SOME_SFS_CODE');
  });

  it('marks an outage as worth retrying and a bad signature as not', () => {
    expect(explain('efactura_unavailable').retryable).toBe(true);
    expect(explain('efactura_signature_invalid').retryable).toBe(false);
  });
});
