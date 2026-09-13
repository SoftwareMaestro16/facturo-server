import type { AiProvider, DraftAnswer, DraftRequest } from './ai-provider';

const NUMBER = /\d+(?:[.,]\d+)?/g;
const BUYER = /(?:для|pentru|client(?:ul)?:?)\s+([^,;\n]+)/i;
const PRICE_MARKER = /\s(?:по|за|x|×|cu|la|câte|cate)\s/i;

/// A local stand-in that reads sentences like
/// "2 часа консультации по 500, 1 логотип за 3000 для Atelier Nord". It sends
/// nothing anywhere and exists so the feature can be built and tested without a
/// provider account. It is not smart, and it does not pretend to be.
export class SandboxAiProvider implements AiProvider {
  readonly isRealProvider = false;

  draftInvoice(request: DraftRequest): Promise<DraftAnswer> {
    const buyerName = BUYER.exec(request.text)?.[1]?.trim() ?? null;
    const body = buyerName ? request.text.replace(BUYER, '') : request.text;
    const lines = body
      .split(/[;\n]|,\s*(?=\d)/)
      .map((segment) => segment.trim())
      .filter((segment) => /\d/.test(segment))
      .map(toLine);

    return Promise.resolve({
      raw: {
        buyerName,
        buyerIdno: /\b\d{13}\b/.exec(request.text)?.[0] ?? null,
        pricesIncludeVat: false,
        notes: null,
        lines,
      },
      inputTokens: 0,
      outputTokens: 0,
    });
  }
}

function toLine(segment: string) {
  const [quantity = '1', price] = segment.match(NUMBER) ?? [];
  const markerAt = segment.search(PRICE_MARKER);
  const name = (markerAt > 0 ? segment.slice(0, markerAt) : segment)
    .replace(NUMBER, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { name, quantity, unitPrice: markerAt > 0 ? (price ?? null) : null, vatRate: null };
}
