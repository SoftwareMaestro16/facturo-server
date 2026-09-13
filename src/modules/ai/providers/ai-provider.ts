/// The boundary with whatever turns a sentence into a draft. Two
/// implementations: a local sandbox for development and tests, and OpenAI. The
/// module factory picks one from env; nothing else knows which is connected.
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface CatalogueItem {
  name: string;
  priceNet: string;
  vatRate: string;
}

export interface DraftRequest {
  text: string;
  locale: 'ru' | 'ro';
  /// The company's own goods and services. Buyers are never part of it.
  catalogue: CatalogueItem[];
}

export interface DraftAnswer {
  /// Untrusted until `parseDraft` has checked it.
  raw: unknown;
  inputTokens: number;
  outputTokens: number;
}

export type AiFailureCode = 'ai_unavailable' | 'ai_busy' | 'ai_refused' | 'ai_failed';

export class AiProviderError extends Error {
  constructor(readonly code: AiFailureCode) {
    super(code);
    this.name = 'AiProviderError';
  }
}

export interface AiProvider {
  readonly isRealProvider: boolean;
  draftInvoice(request: DraftRequest): Promise<DraftAnswer>;
}
