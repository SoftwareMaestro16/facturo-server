import { fromMinor, toMinor } from '@/common/utils/money';

import type { InvoiceStatus } from './invoice-status';

/// One row of a `groupBy status` over outgoing documents, already stripped of
/// Prisma types so the rule below stays testable without a database.
export interface StatusGroup {
  status: InvoiceStatus;
  count: number;
  total: string;
}

export interface InvoiceSummary {
  attentionCount: number;
  draftCount: number;
  errorCount: number;
  awaitingBuyerCount: number;
  awaitingBuyerTotal: string;
  monthIssuedCount: number;
  monthIssuedTotal: string;
  monthFinishedCount: number;
}

/// Things the supplier still has to act on. A cancellation waiting for the
/// buyer is listed too: the supplier started it and should see it until it ends.
const ATTENTION: readonly InvoiceStatus[] = ['DRAFT', 'ERROR', 'CANCELLATION_REQUESTED'];
/// Signed and on its way, but the buyer has not finished it yet.
const AWAITING_BUYER: readonly InvoiceStatus[] = ['SIGNED', 'SENT', 'RECEIVED'];
/// A document that legally exists. Drafts never left Facturo, failed sends and
/// cancelled documents are not turnover, so none of them count as issued.
const ISSUED: readonly InvoiceStatus[] = ['SIGNED', 'SENT', 'RECEIVED', 'FINISHED', 'CANCELLATION_REQUESTED'];

function countOf(groups: readonly StatusGroup[], statuses: readonly InvoiceStatus[]): number {
  return groups
    .filter((group) => statuses.includes(group.status))
    .reduce((sum, group) => sum + group.count, 0);
}

function totalOf(groups: readonly StatusGroup[], statuses: readonly InvoiceStatus[]): string {
  const minor = groups
    .filter((group) => statuses.includes(group.status))
    .reduce((sum, group) => sum + toMinor(group.total), 0);

  return fromMinor(minor);
}

export function summarizeInvoices(
  allTime: readonly StatusGroup[],
  thisMonth: readonly StatusGroup[],
): InvoiceSummary {
  return {
    attentionCount: countOf(allTime, ATTENTION),
    draftCount: countOf(allTime, ['DRAFT']),
    errorCount: countOf(allTime, ['ERROR']),
    awaitingBuyerCount: countOf(allTime, AWAITING_BUYER),
    awaitingBuyerTotal: totalOf(allTime, AWAITING_BUYER),
    monthIssuedCount: countOf(thisMonth, ISSUED),
    monthIssuedTotal: totalOf(thisMonth, ISSUED),
    monthFinishedCount: countOf(thisMonth, ['FINISHED']),
  };
}

/// First day of the calendar month of an ISO day, as an ISO day.
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}
