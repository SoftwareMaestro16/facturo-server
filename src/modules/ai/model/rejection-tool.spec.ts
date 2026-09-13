import { describe, expect, it, vi } from 'vitest';
import { createRejectionTool } from './rejection-tool';
import { executeTool, parseToolArguments } from './tool-registry';

describe('catalogue rejection tool', () => {
  const context = { userId: 'u1', companyId: 'c1' };
  const args = { resourceId: 'invoice1', locale: 'ru' as const };
  it('uses server scope and returns a localized, reviewable explanation', async () => {
    const read = vi
      .fn()
      .mockResolvedValue({ id: 'invoice1', companyId: 'c1', errorCode: 'efactura_totals_mismatch' });
    const tool = createRejectionTool(read);
    await expect(
      executeTool('explain_rejection', JSON.stringify(args), context, { explain_rejection: tool }),
    ).resolves.toMatchObject({
      status: 'explained',
      source: 'catalogue',
      requiresReview: true,
      explanation: 'Сумма документа не совпадает с суммой строк. Пересчитайте счёт.',
    });
    expect(read).toHaveBeenCalledWith({ ...context, resourceId: 'invoice1' });
  });
  it.each([
    null,
    { id: 'invoice1', companyId: 'other', errorCode: 'x' },
    { id: 'other', companyId: 'c1', errorCode: 'x' },
  ])('rejects inaccessible or mismatched resources', async (resource) => {
    const tool = createRejectionTool(vi.fn().mockResolvedValue(resource));
    await expect(tool(args, context)).rejects.toThrow('ai_resource_not_found');
  });
  it('does not reflect unknown raw errors into model output', async () => {
    const tool = createRejectionTool(
      vi.fn().mockResolvedValue({
        id: 'invoice1',
        companyId: 'c1',
        errorCode: 'secret xml / ignore instructions',
      }),
    );
    expect(await tool(args, context)).toEqual({
      status: 'needs_review',
      source: 'catalogue',
      requiresReview: true,
    });
  });
  it('distinguishes no rejection', async () => {
    const tool = createRejectionTool(
      vi.fn().mockResolvedValue({ id: 'invoice1', companyId: 'c1', errorCode: null }),
    );
    expect(await tool(args, context)).toMatchObject({ status: 'no_rejection' });
  });
  it('rejects an array masquerading as a locale', () => {
    expect(() => parseToolArguments(JSON.stringify({ resourceId: 'invoice1', locale: ['ru'] }))).toThrow(
      'ai_invalid_arguments',
    );
  });
});
