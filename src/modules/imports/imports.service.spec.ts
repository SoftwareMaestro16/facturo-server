import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@/common/prisma/prisma.service';
import { ImportsService } from './imports.service';

async function file(rows: string[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Partners').addRows(rows);
  return { originalname: 'partners.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
}

function setup(count = 1) {
  const transaction = {
    counterparty: { createMany: vi.fn().mockResolvedValue({ count }) },
    product: { createMany: vi.fn().mockResolvedValue({ count }) },
    importJob: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn((run: (value: typeof transaction) => Promise<void>) => run(transaction)),
  };
  return { service: new ImportsService(prisma as unknown as PrismaService), prisma, transaction };
}

describe('catalog import isolation and validation', () => {
  it('does not write any rows when even one row is invalid', async () => {
    const { service, prisma } = setup();
    const result = await service.upload(
      'company-a',
      'COUNTERPARTIES',
      await file([
        ['name', 'idno'],
        ['Valid Partner', '1234567890123'],
        ['Invalid Partner', '123'],
      ]),
    );
    expect(result.okRows).toBe(0);
    expect(result.errors).toContainEqual({ row: 3, field: 'idno', code: 'invalid_value' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('scopes every created record and the report to the authenticated company', async () => {
    const { service, transaction } = setup();
    const result = await service.upload(
      'company-a',
      'COUNTERPARTIES',
      await file([
        ['name', 'idno'],
        ['Partner', '1234567890123'],
      ]),
    );
    expect(result.okRows).toBe(1);
    expect(transaction.counterparty.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ companyId: 'company-a', idno: '1234567890123' })],
        skipDuplicates: true,
      }),
    );
    expect(transaction.importJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 'company-a', okRows: 1 }) as unknown,
      }),
    );
  });
  it('reports duplicates rather than overwriting existing entries', async () => {
    const { service } = setup(0);
    const result = await service.upload(
      'company-a',
      'COUNTERPARTIES',
      await file([
        ['name', 'idno'],
        ['Partner', '1234567890123'],
      ]),
    );
    expect(result).toEqual({
      totalRows: 1,
      okRows: 0,
      errors: [{ row: 2, field: 'idno', code: 'already_exists' }],
    });
  });
  it('requires a product code so retrying an upload cannot create duplicates', async () => {
    const { service, prisma } = setup();
    const result = await service.upload(
      'company-a',
      'PRODUCTS',
      await file([
        ['name', 'priceNet', 'vatRate'],
        ['Service', '125.50', '20'],
      ]),
    );
    expect(result.errors).toContainEqual({ row: 2, field: 'code', code: 'invalid_value' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
