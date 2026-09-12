import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

import { PrismaService } from '@/common/prisma/prisma.service';
import { normalizePhone } from '@/common/utils/phone';

import type { CompanyResponse, CompanySummary, CreateCompanyDto, UpdateCompanyDto } from './dto';

export interface SwitchedCompany {
  companyId: string;
  role: UserRole;
}

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

  async listMine(userId: string, currentCompanyId: string | null): Promise<CompanySummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { company: { select: { id: true, name: true, idno: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      id: membership.company.id,
      name: membership.company.name,
      idno: membership.company.idno,
      role: membership.role,
      isCurrent: membership.company.id === currentCompanyId,
    }));
  }

  async create(userId: string, dto: CreateCompanyDto): Promise<SwitchedCompany> {
    const existingCompany = await this.prisma.company.findUnique({
      where: { idno: dto.idno },
      select: { id: true },
    });

    if (existingCompany) {
      throw new ConflictException({ code: 'company_exists', message: 'This IDNO is already registered' });
    }

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          idno: dto.idno,
          vatCode: dto.vatCode ?? null,
          isVatPayer: Boolean(dto.vatCode),
          locale: dto.locale ?? 'ro',
          numberSeries: { create: { series: 'FAC', isDefault: true } },
        },
      });

      await tx.membership.create({ data: { userId, companyId: company.id, role: 'OWNER' } });
      await tx.user.update({ where: { id: userId }, data: { companyId: company.id, role: 'OWNER' } });

      return { companyId: company.id, role: 'OWNER' };
    });
  }

  async switchTo(userId: string, companyId: string): Promise<SwitchedCompany> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    if (!membership) {
      throw new ForbiddenException({ code: 'not_a_member', message: 'Not a member of this company' });
    }

    await this.prisma.user.update({ where: { id: userId }, data: { companyId, role: membership.role } });

    return { companyId, role: membership.role };
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
