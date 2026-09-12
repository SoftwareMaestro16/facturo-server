import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { readWorkbook } from './workbook';

async function sheet(rows: (string | number | { formula: string })[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Data').addRows(rows);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('catalog workbook boundary', () => {
  it('preserves text identifiers and real Excel row numbers', async () => {
    const file = await sheet([['name', 'idno'], [], ['Partner', '0012345678901']]);
    await expect(readWorkbook(file)).resolves.toEqual([
      { row: 3, values: { name: 'Partner', idno: '0012345678901' } },
    ]);
  });
  it('rejects unknown headers instead of silently dropping data', async () => {
    await expect(
      readWorkbook(
        await sheet([
          ['name', 'companyId'],
          ['Partner', 'foreign-company'],
        ]),
      ),
    ).rejects.toThrow();
  });
  it('does not use cached formula results as fiscal data', async () => {
    await expect(
      readWorkbook(
        await sheet([
          ['name', 'priceNet'],
          ['Service', { formula: '1+1' }],
        ]),
      ),
    ).rejects.toThrow();
  });
  it('rejects files without rows and malformed archives', async () => {
    await expect(readWorkbook(await sheet([['name', 'idno']]))).rejects.toThrow();
    await expect(readWorkbook(Buffer.from('not an Excel file'))).rejects.toThrow();
  });
  it('rejects oversized uploads before parsing', async () => {
    await expect(readWorkbook(Buffer.alloc(1024 * 1024 + 1))).rejects.toThrow();
  });
});
