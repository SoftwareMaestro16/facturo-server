import { describe, expect, it } from 'vitest';

import { canTransition, countsAgainstQuota, isEditable, isTerminal, nextStatuses } from './invoice-status';

describe('the path a document takes', () => {
  it('goes draft, signed, sent, received, finished', () => {
    expect(canTransition('LONG', 'DRAFT', 'SIGNED')).toBe(true);
    expect(canTransition('LONG', 'SIGNED', 'SENT')).toBe(true);
    expect(canTransition('LONG', 'SENT', 'RECEIVED')).toBe(true);
    expect(canTransition('LONG', 'RECEIVED', 'FINISHED')).toBe(true);
  });

  it('never jumps straight from a draft to finished', () => {
    expect(canTransition('LONG', 'DRAFT', 'FINISHED')).toBe(false);
    expect(canTransition('SHORT', 'DRAFT', 'FINISHED')).toBe(false);
  });

  it('lets a failed submission go back to the draft the customer can fix', () => {
    expect(canTransition('LONG', 'ERROR', 'DRAFT')).toBe(true);
  });
});

describe('cancelling a finished document', () => {
  it('needs the buyer to agree in the long cycle', () => {
    expect(canTransition('LONG', 'FINISHED', 'CANCELLED')).toBe(false);
    expect(canTransition('LONG', 'FINISHED', 'CANCELLATION_REQUESTED')).toBe(true);
    expect(canTransition('LONG', 'CANCELLATION_REQUESTED', 'CANCELLED')).toBe(true);
  });

  it('lets the buyer refuse, which puts the document back to finished', () => {
    expect(canTransition('LONG', 'CANCELLATION_REQUESTED', 'FINISHED')).toBe(true);
  });

  it('is the supplier alone in the short cycle, because nobody signed inside the system', () => {
    expect(canTransition('SHORT', 'FINISHED', 'CANCELLED')).toBe(true);
    expect(nextStatuses('SHORT', 'CANCELLATION_REQUESTED')).toHaveLength(0);
  });
});

describe('editing and finality', () => {
  it('allows editing only while the document is a draft', () => {
    expect(isEditable('DRAFT')).toBe(true);
    expect(isEditable('SIGNED')).toBe(false);
  });

  it('treats cancellation as final in both cycles', () => {
    expect(isTerminal('LONG', 'CANCELLED')).toBe(true);
    expect(isTerminal('SHORT', 'CANCELLED')).toBe(true);
  });

  it('treats a finished long-cycle document as not quite final, because it can still be unwound', () => {
    expect(isTerminal('LONG', 'FINISHED')).toBe(false);
    expect(isTerminal('SHORT', 'FINISHED')).toBe(false);
  });
});

describe('quota', () => {
  it('does not bill for a draft that was never signed or for a failed send', () => {
    expect(countsAgainstQuota('DRAFT')).toBe(false);
    expect(countsAgainstQuota('ERROR')).toBe(false);
  });

  it('bills once the document has been signed', () => {
    expect(countsAgainstQuota('SIGNED')).toBe(true);
    expect(countsAgainstQuota('FINISHED')).toBe(true);
  });
});
