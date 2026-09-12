import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/common/prisma/prisma.service';
import { normalizePhone } from '@/common/utils/phone';

import type { CompanyResponse, UpdateCompanyDto } from './dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOwn(companyId: string): Promise<CompanyResponse> {
    return this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: SELECTION });
  }

  async update(companyId: string, dto: UpdateCompanyDto): Promise<CompanyResponse> {
    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...dto,
        phone: dto.phone === undefined ? undefined : normalizePhone(dto.phone),
        // Whether the company is a VAT payer follows from whether it has a VAT
        // code. Keeping the two as independent fields lets them contradict each
        // other, and the contradiction surfaces as a rejected document.
        isVatPayer: dto.vatCode === undefined ? undefined : Boolean(dto.vatCode),
      },
      select: SELECTION,
    });
  }
}

const SELECTION = {
  id: true,
  idno: true,
  name: true,
  vatCode: true,
  isVatPayer: true,
  address: true,
  city: true,
  country: true,
  email: true,
  phone: true,
  iban: true,
  bankName: true,
  bankBic: true,
  locale: true,
} as const;
