import { ForbiddenException, HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '@/common/prisma/prisma.service';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import type { TypedConfigService } from '@/config/typed-config.service';

import { AiService } from './ai.service';
import { AiProviderError } from './providers/ai-provider';

const user: AuthenticatedUser = { userId: 'u1', companyId: 'c1', role: 'OWNER', email: 'owner@example.md' };
const dto = { text: '2 ore consultanță pentru Atelier Nord', locale: 'ro' as const };
const decimal = (value: string) => ({ toFixed: (digits: number) => Number(value).toFixed(digits) });

function setup(
  options: { enabled?: boolean; used?: number; answer?: unknown; failure?: AiProviderError } = {},
) {
  const prisma = {
    company: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ aiEnabledAt: options.enabled === false ? null : new Date() }),
    },
    aiRequest: { count: vi.fn().mockResolvedValue(options.used ?? 0), create: vi.fn().mockResolvedValue({}) },
    product: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 'p1', name: 'Consultanță IT', priceNet: decimal('500'), vatRate: decimal('20') },
        ]),
    },
    counterparty: {
      findMany: vi.fn().mockResolvedValue([{ id: 'b1', name: 'Atelier Nord SRL', idno: '1003600012345' }]),
    },
  };
  const provider = {
    isRealProvider: true,
    draftInvoice: options.failure
      ? vi.fn().mockRejectedValue(options.failure)
      : vi.fn().mockResolvedValue({ raw: options.answer, inputTokens: 12, outputTokens: 7 }),
  };
  const config = { get: (key: string) => (key === 'AI_DAILY_LIMIT' ? 30 : undefined), isProduction: true };
  const service = new AiService(
    prisma as unknown as PrismaService,
    config as unknown as TypedConfigService,
    provider,
  );
  return { service, prisma, provider };
}

const answer = {
  buyerName: 'Atelier Nord',
  buyerIdno: null,
  pricesIncludeVat: false,
  notes: null,
  lines: [{ name: 'Consultanță IT', quantity: '2', unitPrice: null, vatRate: null }],
};

describe('AI invoice draft', () => {
  it('does nothing until the owner has turned the assistant on', async () => {
    const { service, provider } = setup({ enabled: false, answer });
    await expect(service.draftInvoice(user, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(provider.draftInvoice).not.toHaveBeenCalled();
  });

  it('stops at the daily limit before calling the provider', async () => {
    const { service, provider } = setup({ used: 30, answer });
    await expect(service.draftInvoice(user, dto)).rejects.toMatchObject({ status: 429 });
    expect(provider.draftInvoice).not.toHaveBeenCalled();
  });

  it('scopes every lookup to the company and never sends the buyer list', async () => {
    const { service, prisma, provider } = setup({ answer });
    await service.draftInvoice(user, dto);

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', isArchived: false } }),
    );
    expect(prisma.counterparty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', isArchived: false } }),
    );
    const sent = JSON.stringify(provider.draftInvoice.mock.calls[0]);
    expect(sent).not.toContain('1003600012345');
    expect(sent).not.toContain('Atelier Nord SRL');
  });

  it('matches the buyer and fills price and rate from the catalogue', async () => {
    const { service, prisma } = setup({ answer });
    await expect(service.draftInvoice(user, dto)).resolves.toMatchObject({
      counterpartyId: 'b1',
      lines: [{ name: 'Consultanță IT', quantity: '2', priceNet: '500.00', vatRate: '20', productId: 'p1' }],
      warnings: [],
    });
    expect(prisma.aiRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId: 'c1', succeeded: true, inputTokens: 12 }) as unknown,
    });
  });

  it('records a failed attempt and answers with a stable code', async () => {
    const { service, prisma } = setup({ failure: new AiProviderError('ai_busy') });
    const failure = await service.draftInvoice(user, dto).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(503);
    expect((failure as HttpException).getResponse()).toMatchObject({ code: 'ai_busy' });
    expect(prisma.aiRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ succeeded: false }) as unknown,
    });
  });

  it('warns instead of guessing when the buyer is unknown', async () => {
    const { service } = setup({ answer: { ...answer, buyerName: 'Moldcell' } });
    await expect(service.draftInvoice(user, dto)).resolves.toMatchObject({
      counterpartyId: null,
      warnings: ['buyer_not_found'],
    });
  });
});
