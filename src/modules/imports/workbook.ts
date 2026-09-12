import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { unzipSync } from 'fflate';

export interface SheetRow {
  row: number;
  values: Record<string, string>;
}
const HEADERS = new Set([
  'name',
  'idno',
  'vatCode',
  'email',
  'phone',
  'address',
  'iban',
  'bankName',
  'code',
  'unit',
  'priceNet',
  'vatRate',
]);

/// Bound the archive before ExcelJS builds its in-memory document.
export async function readWorkbook(buffer: Buffer): Promise<SheetRow[]> {
  if (buffer.length > 1024 * 1024) throw invalidFile();
  try {
    checkArchive(buffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(buffer).buffer);
    if (workbook.worksheets.length !== 1) throw invalidFile();
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 1001 || sheet.columnCount > 20) throw invalidFile();
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, column) => {
      const header = cell.text.trim();
      if (!HEADERS.has(header) || headers.includes(header)) throw invalidFile();
      headers[column] = header;
    });
    if (!headers.includes('name')) throw invalidFile();
    const rows: SheetRow[] = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const values: Record<string, string> = {};
      row.eachCell((cell, column) => {
        const header = headers[column];
        if (!header || cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error)
          throw invalidFile();
        const value = cell.text.trim();
        if (value.length > 300) throw invalidFile();
        if (value) values[header] = value;
      });
      if (Object.keys(values).length) rows.push({ row: index, values });
    });
    if (!rows.length) throw invalidFile();
    return rows;
  } catch {
    throw invalidFile();
  }
}

function checkArchive(buffer: Buffer): void {
  let expanded = 0;
  let entries = 0;
  unzipSync(new Uint8Array(buffer), {
    filter: (entry) => {
      expanded += entry.originalSize;
      entries += 1;
      if (expanded > 8 * 1024 * 1024 || entries > 100) throw invalidFile();
      return false;
    },
  });
}

function invalidFile(): BadRequestException {
  return new BadRequestException({
    code: 'import_invalid_file',
    message: 'Use a single-sheet XLSX with supported headers, at most 1000 rows and 1 MB',
  });
}
