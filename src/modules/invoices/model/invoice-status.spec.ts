import { describe, expect, it } from 'vitest';

import { canTransition, isEditable, isTerminal } from './invoice-status';

describe('invoice status machine', () => {
  it('lets a draft be sent and cancelled but not accepted outright', () => {
    expect(canTransition('DRAFT', 'SIGNING')).toBe(true);
    expect(canTransition('DRAFT', 'ACCEPTED')).toBe(false);
  });

  it('lets a failed submission go back to the draft the customer can fix', () => {
    expect(canTransition('ERROR', 'DRAFT')).toBe(true);
  });

  it('treats acceptance and cancellation as final', () => {
    expect(isTerminal('ACCEPTED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('SENT')).toBe(false);
  });

  it('allows editing only while the document is a draft', () => {
    expect(isEditable('DRAFT')).toBe(true);
    expect(isEditable('SENT')).toBe(false);
  });
});
