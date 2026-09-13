import { describe, expect, it } from 'vitest';

import { canAcceptIncoming, canRejectIncoming } from './incoming';

describe('canAcceptIncoming', () => {
  it('allows accepting only a document still waiting for a decision', () => {
    expect(canAcceptIncoming('RECEIVED')).toBe(true);
  });

  it.each(['DRAFT', 'SIGNED', 'SENT', 'FINISHED', 'CANCELLED', 'ERROR'] as const)(
    'refuses a document already past that point (%s)',
    (status) => {
      expect(canAcceptIncoming(status)).toBe(false);
    },
  );
});

describe('canRejectIncoming', () => {
  it('allows disputing an undecided document once', () => {
    expect(canRejectIncoming('RECEIVED', null)).toBe(true);
  });

  it('refuses a document already disputed', () => {
    expect(canRejectIncoming('RECEIVED', new Date())).toBe(false);
  });

  it('refuses a document that has since moved on', () => {
    expect(canRejectIncoming('FINISHED', null)).toBe(false);
  });
});
