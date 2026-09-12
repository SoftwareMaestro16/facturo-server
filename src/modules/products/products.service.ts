import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { pageMeta } from '@/common/dto';
import { PrismaService } from '@/common/prisma/prisma.service';

import type { CreateProductDto, ProductPage, ProductQuery, ProductResponse, UpdateProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: ProductQuery): Promise<ProductPage> {
    const where: Prisma.ProductWhereInput = {
      companyId,
      ...(query.includeArchived ? {} : { isArchived: false }),
      ...(query.search ? { OR: searchClauses(query.search) } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: SELECTION,
        orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map(serialize),
      meta: pageMeta(query, total),
    };
  }

  async findOne(companyId: string, id: string): Promise<ProductResponse> {
    // findFirst with both conditions, not findUnique plus a check: the latter
    // tells the caller whether an id exists in someone else's company.
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      select: SELECTION,
    });

    if (!product) {
      throw notFound();
    }

    return serialize(product);
  }

  async create(companyId: string, dto: CreateProductDto): Promise<ProductResponse> {
    if (dto.code) {
      const clash = await this.prisma.product.findFirst({
        where: { companyId, code: dto.code },
        select: { id: true },
      });

      if (clash) {
        throw new ConflictException({
          code: 'product_code_exists',
          message: 'A product with this code already exists',
        });
      }
    }

    const created = await this.prisma.product.create({
      data: {
        companyId,
        code: dto.code ?? null,
        name: dto.name,
        unit: dto.unit ?? 'H87',
        priceNet: dto.priceNet,
        vatRate: dto.vatRate,
      },
      select: SELECTION,
    });

    return serialize(created);
  }

  async update(companyId: string, id: string, dto: UpdateProductDto): Promise<ProductResponse> {
    await this.findOne(companyId, id);

    const { count } = await this.prisma.product.updateMany({
      where: { id, companyId },
      data: dto,
    });

    if (count === 0) {
      throw notFound();
    }

    return this.findOne(companyId, id);
  }

  /// Archived rather than deleted: past invoices name this product, and they
  /// are fiscal records for six years.
  async archive(companyId: string, id: string): Promise<ProductResponse> {
    return this.update(companyId, id, { isArchived: true });
  }
}

function searchClauses(search: string): Prisma.ProductWhereInput[] {
  return [
    { name: { contains: search, mode: 'insensitive' } },
    { code: { contains: search, mode: 'insensitive' } },
  ];
}

/// Prisma returns Decimal objects, but the OpenAPI contract for a product
/// promises a fixed-scale string. The global interceptor does this for API
/// responses; doing it inline here means the service can be composed by other
/// services without depending on the interceptor.
function serialize(row: {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  priceNet: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  isArchived: boolean;
}): ProductResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    priceNet: row.priceNet.toFixed(2),
    vatRate: row.vatRate.toFixed(2),
    isArchived: row.isArchived,
  };
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: 'product_not_found', message: 'Product not found' });
}

const SELECTION = {
  id: true,
  code: true,
  name: true,
  unit: true,
  priceNet: true,
  vatRate: true,
  isArchived: true,
} as const;
