import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '@/common/prisma/prisma.service';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { TypedConfigService } from '@/config/typed-config.service';

import type { AiStatusResponse, InvoiceDraftDto, InvoiceDraftResponse } from './dto/ai.dto';
import { type ParsedDraft, parseDraft } from './model/invoice-draft';
import { matchByName } from './model/matching';
import { hasAiQuota, utcDayStart } from './model/quota';
import { AI_PROVIDER, type AiProvider, AiProviderError, type DraftAnswer } from './providers/ai-provider';

/// Enough of a catalogue for the model to reuse names and prices, small enough
/// to keep a request cheap.
const CATALOGUE_LIMIT = 100;
const BUYER_LIMIT = 1000;

const FAILURE_STATUS: Record<AiProviderError['code'], HttpStatus> = {
  ai_unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  ai_busy: HttpStatus.SERVICE_UNAVAILABLE,
  ai_refused: HttpStatus.UNPROCESSABLE_ENTITY,
  ai_failed: HttpStatus.BAD_GATEWAY,
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: TypedConfigService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

  async status(companyId: string): Promise<AiStatusResponse> {
    const [company, usedToday] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { aiEnabledAt: true } }),
      this.usedToday(companyId),
    ]);

    return {
      enabled: company.aiEnabledAt !== null,
      enabledAt: company.aiEnabledAt?.toISOString() ?? null,
      // A heuristic stand-in must not be offered to paying customers as "AI".
      available: this.provider.isRealProvider || !this.config.isProduction,
      usedToday,
      dailyLimit: this.config.get('AI_DAILY_LIMIT'),
    };
  }

  async setEnabled(user: AuthenticatedUser, enabled: boolean): Promise<AiStatusResponse> {
    await this.prisma.company.update({
      where: { id: user.companyId },
      data: enabled
        ? { aiEnabledAt: new Date(), aiEnabledByUserId: user.userId }
        : { aiEnabledAt: null, aiEnabledByUserId: null },
    });

    return this.status(user.companyId);
  }

  async draftInvoice(user: AuthenticatedUser, dto: InvoiceDraftDto): Promise<InvoiceDraftResponse> {
    await this.assertAllowed(user.companyId);
    const products = await this.prisma.product.findMany({
      where: { companyId: user.companyId, isArchived: false },
      orderBy: { updatedAt: 'desc' },
      take: CATALOGUE_LIMIT,
      select: { id: true, name: true, priceNet: true, vatRate: true },
    });

    const answer = await this.ask(user, {
      text: dto.text,
      locale: dto.locale,
      catalogue: products.map((product) => ({
        name: product.name,
        priceNet: product.priceNet.toFixed(2),
        vatRate: product.vatRate.toFixed(0),
      })),
    });

    const draft = parseDraft(answer.raw);
    if (draft.lines.length === 0) {
      throw new UnprocessableEntityException({ code: 'ai_nothing_found', message: 'No invoice lines found' });
    }

    return this.resolve(user.companyId, draft, products);
  }

  private async assertAllowed(companyId: string): Promise<void> {
    const status = await this.status(companyId);
    if (!status.available) {
      throw new HttpException({ code: 'ai_unavailable', message: 'AI is not connected' }, 503);
    }
    if (!status.enabled) {
      throw new ForbiddenException({
        code: 'ai_disabled',
        message: 'The owner has not enabled the assistant',
      });
    }
    if (!hasAiQuota(status.usedToday, status.dailyLimit)) {
      throw new HttpException({ code: 'ai_quota_exceeded', message: 'Daily AI limit reached' }, 429);
    }
  }

  /// Every call is recorded, successful or not: the limit counts attempts,
  /// because a failing provider still costs money and time.
  private async ask(user: AuthenticatedUser, request: Parameters<AiProvider['draftInvoice']>[0]) {
    let answer: DraftAnswer | undefined;
    try {
      answer = await this.provider.draftInvoice(request);
      return answer;
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw new HttpException({ code: error.code, message: error.code }, FAILURE_STATUS[error.code]);
      }
      throw error;
    } finally {
      await this.prisma.aiRequest.create({
        data: {
          companyId: user.companyId,
          userId: user.userId,
          kind: 'INVOICE_DRAFT',
          succeeded: answer !== undefined,
          inputTokens: answer?.inputTokens ?? 0,
          outputTokens: answer?.outputTokens ?? 0,
        },
      });
    }
  }

  private async resolve(
    companyId: string,
    draft: ParsedDraft,
    products: {
      id: string;
      name: string;
      priceNet: { toFixed(digits: number): string };
      vatRate: { toFixed(digits: number): string };
    }[],
  ): Promise<InvoiceDraftResponse> {
    const warnings = new Set<string>(draft.warnings);
    const counterpartyId = await this.findBuyer(companyId, draft, warnings);

    const lines = draft.lines.map((line) => {
      const match = matchByName(products, line.name);
      const product = match.kind === 'match' ? products.find((item) => item.id === match.id) : undefined;
      const vatRate = line.vatRate ?? (product?.vatRate.toFixed(0) as '20' | '8' | '0' | undefined);
      if (!vatRate) warnings.add('vat_assumed');
      const priceNet = line.priceNet ?? product?.priceNet.toFixed(2) ?? null;
      if (!priceNet) warnings.add('price_missing');

      return {
        name: line.name,
        quantity: line.quantity,
        priceNet,
        vatRate: vatRate ?? '20',
        productId: product?.id ?? null,
      };
    });

    return { counterpartyId, buyerName: draft.buyerName, notes: draft.notes, lines, warnings: [...warnings] };
  }

  private async findBuyer(
    companyId: string,
    draft: ParsedDraft,
    warnings: Set<string>,
  ): Promise<string | null> {
    if (!draft.buyerName && !draft.buyerIdno) return null;

    const buyers = await this.prisma.counterparty.findMany({
      where: { companyId, isArchived: false },
      take: BUYER_LIMIT,
      select: { id: true, name: true, idno: true },
    });

    const byIdno = draft.buyerIdno ? buyers.find((buyer) => buyer.idno === draft.buyerIdno) : undefined;
    if (byIdno) return byIdno.id;

    const match = matchByName(buyers, draft.buyerName);
    if (match.kind === 'match') return match.id;
    warnings.add(match.kind === 'ambiguous' ? 'buyer_ambiguous' : 'buyer_not_found');
    return null;
  }

  private usedToday(companyId: string): Promise<number> {
    return this.prisma.aiRequest.count({ where: { companyId, createdAt: { gte: utcDayStart(new Date()) } } });
  }
}
