import { describe, expect, it, vi } from 'vitest';
import { executeTool, parseToolArguments, toolDefinitions } from './tool-registry';

describe('AI tool boundary', () => {
  const context = { userId: 'user', companyId: 'company' };
  const args = JSON.stringify({ resourceId: 'upload-1', locale: 'ru' });
  it('advertises no unfinished handlers', () => {
    expect(toolDefinitions({})).toEqual([]);
  });
  it('passes server context and parsed input to an installed handler', async () => {
    const handler = vi.fn().mockResolvedValue({ proposal: true });
    await expect(
      executeTool('extract_receipt', args, context, { extract_receipt: handler }),
    ).resolves.toEqual({ proposal: true });
    expect(handler).toHaveBeenCalledWith({ resourceId: 'upload-1', locale: 'ru' }, context);
    expect(toolDefinitions({ extract_receipt: handler })[0]?.strict).toBe(true);
  });
  it('rejects model-supplied company overrides', () => {
    expect(() =>
      parseToolArguments(JSON.stringify({ resourceId: 'upload-1', locale: 'ru', companyId: 'other' })),
    ).toThrow('ai_invalid_arguments');
  });
  it.each([
    'null',
    '[]',
    '{}',
    '{"resourceId":"https://example.com","locale":"ru"}',
    '{"resourceId":"one","locale":"en"}',
    'x'.repeat(4097),
  ])('rejects invalid input', (raw) => {
    expect(() => parseToolArguments(raw)).toThrow();
  });
  it('fails closed for missing identity, unknown tools and absent handlers', async () => {
    await expect(executeTool('extract_receipt', args, { userId: '', companyId: '' }, {})).rejects.toThrow(
      'ai_company_required',
    );
    await expect(executeTool('delete_company', args, context, {})).rejects.toThrow('ai_unknown_tool');
    await expect(executeTool('extract_receipt', args, context, {})).rejects.toThrow('ai_tool_unavailable');
  });
});
