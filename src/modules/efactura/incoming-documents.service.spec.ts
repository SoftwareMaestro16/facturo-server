import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '@/common/audit/audit.service';
import type { PrismaService } from '@/common/prisma/prisma.service';

import { IncomingDocumentsService } from './incoming-documents.service';
import type { EfacturaProvider, IncomingDocument } from './providers/efactura-provider';

const RECEIVED_INVOICE = {
  id: 'invoice-1',
  status: 'RECEIVED',
  disputedAt: null,
  efacturaId: 'SFS-1',
};

function setup(invoice: Record<string, unknown> | null = RECEIVED_INVOICE) {
  const prisma = {
    invoice: {
      findFirst: vi.fn().mockResolvedValue(invoice),
      update: vi.fn(),
      create: vi.fn(),
    },
    numberSeries: { upsert: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        numberSeries: {
          upsert: vi.fn(),
          findFirst: vi.fn().mockResolvedValue({ id: 'series-1', series: 'IN', nextValue: 1 }),
          update: vi.fn(),
        },
        invoice: { create: vi.fn() },
      });
    }),
  };
  const audit = { record: vi.fn() };
  const provider = {
    listIncoming: vi.fn().mockResolvedValue([]),
    act: vi
      .fn()
      .mockResolvedValue({ externalId: 'SFS-1', state: 'FINISHED', changedAt: new Date().toISOString() }),
  };
  const service = new IncomingDocumentsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    provider as unknown as EfacturaProvider,
  );

  return { service, prisma, audit, provider };
}

describe('acceptIncoming', () => {
  it('signs through the provider and finishes the local row', async () => {
    const { service, prisma, provider } = setup();

    const status = await service.acceptIncoming('company-1', 'invoice-1');

    expect(provider.act).toHaveBeenCalledWith('SFS-1', 'SIGN');
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invoice-1' },
        data: expect.objectContaining({ status: 'FINISHED' }) as unknown,
      }),
    );
    expect(status).toBe('FINISHED');
  });

  it('refuses a document not waiting for a decision', async () => {
    const { service, provider } = setup({ ...RECEIVED_INVOICE, status: 'FINISHED' });

    await expect(service.acceptIncoming('company-1', 'invoice-1')).rejects.toBeInstanceOf(ConflictException);
    expect(provider.act).not.toHaveBeenCalled();
  });

  it('refuses when the invoice does not belong to this company', async () => {
    const { service } = setup(null);

    await expect(service.acceptIncoming('company-1', 'invoice-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('rejectIncoming', () => {
  it('records the dispute locally without calling the provider', async () => {
    const { service, prisma, provider } = setup();

    await service.rejectIncoming('company-1', 'invoice-1', 'Wrong quantity');

    expect(provider.act).not.toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invoice-1' },
        data: expect.objectContaining({ statusReason: 'Wrong quantity' }) as unknown,
      }),
    );
  });

  it('refuses a document already disputed', async () => {
    const { service } = setup({ ...RECEIVED_INVOICE, disputedAt: new Date() });

    await expect(service.rejectIncoming('company-1', 'invoice-1', 'again')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('syncIncoming', () => {
  const document: IncomingDocument = {
    externalId: 'SFS-2',
    cycle: 'LONG',
    supplier: { name: 'Supplier SRL', idno: '1234567890123' },
    series: 'A',
    number: '10',
    issueDate: '2026-09-14',
    total: '100.00',
    currency: 'MDL',
    rawXml: '<Factura/>',
  };

  it('stores a document not already synced', async () => {
    const { service, provider, prisma } = setup();
    provider.listIncoming.mockResolvedValue([document]);
    prisma.invoice.findFirst.mockResolvedValue(null);

    const result = await service.syncIncoming('company-1');

    expect(result).toEqual({ created: 1 });
  });

  it('skips a document already synced', async () => {
    const { service, provider, prisma } = setup();
    provider.listIncoming.mockResolvedValue([document]);
    prisma.invoice.findFirst.mockResolvedValue({ id: 'existing' });

    const result = await service.syncIncoming('company-1');

    expect(result).toEqual({ created: 0 });
  });
});
