import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PaginationQuery, pageMeta } from '@/common/dto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { normalizePhone } from '@/common/utils/phone';

import type {
  CounterpartyPage,
  CounterpartyResponse,
  CreateCounterpartyDto,
  UpdateCounterpartyDto,
} from './dto';

@Injectable()
export class CounterpartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: PaginationQuery): Promise<CounterpartyPage> {
    const where: Prisma.CounterpartyWhereInput = {
      companyId,
      ...(query.search ? { OR: searchClauses(query.search) } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.counterparty.findMany({
        where,
        select: SELECTION,
        // Archived entries sink to the bottom rather than disappearing: people
        // archive by accident and then cannot find what they archived.
        orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.counterparty.count({ where }),
    ]);

    return { items, meta: pageMeta(query, total) };
  }

  async findOne(companyId: string, id: string): Promise<CounterpartyResponse> {
    // findFirst with both conditions, not findUnique plus a check: the latter
    // tells the caller whether an id exists in someone else's company.
    const counterparty = await this.prisma.counterparty.findFirst({
      where: { id, companyId },
      select: SELECTION,
    });

    if (!counterparty) {
      throw notFound();
    }

    return counterparty;
  }

  async create(companyId: string, dto: CreateCounterpartyDto): Promise<CounterpartyResponse> {
    const existing = await this.prisma.counterparty.findFirst({
      where: { companyId, idno: dto.idno },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'counterparty_exists',
        message: 'A counterparty with this IDNO already exists',
      });
    }

    return this.prisma.counterparty.create({
      data: { ...normalize(dto), companyId, isVatPayer: Boolean(dto.vatCode) },
      select: SELECTION,
    });
  }

  async update(companyId: string, id: string, dto: UpdateCounterpartyDto): Promise<CounterpartyResponse> {
    await this.findOne(companyId, id);

    const { count } = await this.prisma.counterparty.updateMany({
      where: { id, companyId },
      data: {
        ...normalize(dto),
        isVatPayer: dto.vatCode === undefined ? undefined : Boolean(dto.vatCode),
      },
    });

    if (count === 0) {
      throw notFound();
    }

    return this.findOne(companyId, id);
  }

  /// Archiving, not deleting. A counterparty is named on documents that are
  /// fiscal records for six years; removing the row would orphan them.
  async archive(companyId: string, id: string): Promise<CounterpartyResponse> {
    return this.update(companyId, id, { isArchived: true });
  }
}

function normalize<T extends { phone?: string }>(dto: T): T {
  return dto.phone === undefined ? dto : { ...dto, phone: normalizePhone(dto.phone) };
}

function searchClauses(search: string): Prisma.CounterpartyWhereInput[] {
  return [
    { name: { contains: search, mode: 'insensitive' } },
    { idno: { startsWith: search } },
    { vatCode: { startsWith: search } },
  ];
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: 'counterparty_not_found', message: 'Counterparty not found' });
}

const SELECTION = {
  id: true,
  name: true,
  idno: true,
  vatCode: true,
  isVatPayer: true,
  address: true,
  email: true,
  phone: true,
  iban: true,
  bankName: true,
  isArchived: true,
} as const;
