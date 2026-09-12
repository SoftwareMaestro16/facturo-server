import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PrismaService } from '@/common/prisma/prisma.service';
import { normalizePhone } from '@/common/utils/phone';

import { CreateCounterpartyDto } from '../counterparties/dto';
import { CreateProductDto } from '../products/dto';
import type { ImportResponse, ImportUploadDto } from './dto';
import { readWorkbook } from './workbook';

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(
    companyId: string,
    kind: ImportUploadDto['kind'],
    file?: { buffer: Buffer; originalname: string },
  ): Promise<ImportResponse> {
    if (!file || !file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException({ code: 'import_invalid_file', message: 'An XLSX file is required' });
    }
    const rows = await readWorkbook(file.buffer);
    const result: ImportResponse = { totalRows: rows.length, okRows: 0, errors: [] };
    // Validate the complete sheet before writing any row. A corrected file can be
    // uploaded safely: unique company-scoped keys skip already imported records.
    const checked = await Promise.all(
      rows.map(async ({ row, values }) => {
        const dto =
          kind === 'COUNTERPARTIES'
            ? plainToInstance(CreateCounterpartyDto, values)
            : plainToInstance(CreateProductDto, values);
        const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
        for (const error of errors) result.errors.push({ row, field: error.property, code: 'invalid_value' });
        if (kind === 'PRODUCTS' && !values.code)
          result.errors.push({ row, field: 'code', code: 'invalid_value' });
        return { row, dto };
      }),
    );
    if (result.errors.length) return result;
    await this.persist(companyId, kind, file.originalname, checked, result);
    return result;
  }

  private async persist(
    companyId: string,
    kind: ImportUploadDto['kind'],
    fileName: string,
    checked: { row: number; dto: CreateCounterpartyDto | CreateProductDto }[],
    result: ImportResponse,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        for (const { row, dto } of checked) {
          const outcome = await this.insertRow(transaction, companyId, dto);
          if (outcome.count) result.okRows += 1;
          else
            result.errors.push({ row, field: kind === 'PRODUCTS' ? 'code' : 'idno', code: 'already_exists' });
        }
        await transaction.importJob.create({
          data: {
            companyId,
            kind,
            status: 'DONE',
            fileName: fileName.slice(0, 255),
            totalRows: result.totalRows,
            okRows: result.okRows,
            errorRows: result.errors.length,
            errors: result.errors as unknown as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
      },
      { timeout: 30000 },
    );
  }

  private insertRow(
    transaction: Prisma.TransactionClient,
    companyId: string,
    dto: CreateCounterpartyDto | CreateProductDto,
  ) {
    return dto instanceof CreateCounterpartyDto
      ? transaction.counterparty.createMany({
          data: [
            {
              ...dto,
              companyId,
              phone: dto.phone ? normalizePhone(dto.phone) : undefined,
              isVatPayer: Boolean(dto.vatCode),
            },
          ],
          skipDuplicates: true,
        })
      : transaction.product.createMany({
          data: [{ ...dto, companyId, unit: dto.unit ?? 'H87' }],
          skipDuplicates: true,
        });
  }
}
