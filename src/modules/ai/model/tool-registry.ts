/** Responses API function contracts. No model-supplied tenant identifiers. */
export const TOOL_NAMES = ['extract_receipt', 'explain_rejection', 'map_spreadsheet'] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export interface ToolArguments {
  resourceId: string;
  locale: 'ru' | 'ro';
}
export interface ToolContext {
  userId: string;
  companyId: string;
}
export type ToolHandler = (args: ToolArguments, context: ToolContext) => Promise<unknown>;
export type ToolHandlers = Partial<Record<ToolName, ToolHandler>>;

const descriptions: Record<ToolName, string> = {
  extract_receipt: 'Propose receipt fields from an owned uploaded document. Never save an invoice.',
  explain_rejection: 'Explain an owned invoice rejection using the error catalogue first. Never submit it.',
  map_spreadsheet: 'Propose column mappings for an owned spreadsheet upload. Never import rows.',
};

export function toolDefinitions(handlers: ToolHandlers) {
  return TOOL_NAMES.filter((name) => typeof handlers[name] === 'function').map((name) => ({
    type: 'function' as const,
    name,
    description: descriptions[name],
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        resourceId: { type: 'string', description: 'Opaque ID of a resource already uploaded to Facturo.' },
        locale: { type: 'string', enum: ['ru', 'ro'] },
      },
      required: ['resourceId', 'locale'],
    },
  }));
}

export function parseToolArguments(raw: string): ToolArguments {
  if (raw.length > 4096) throw new Error('ai_arguments_too_large');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ai_invalid_arguments');
  const args = value as Record<string, unknown>;
  if (
    Object.keys(args).length !== 2 ||
    typeof args.resourceId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(args.resourceId) ||
    typeof args.locale !== 'string' ||
    !['ru', 'ro'].includes(args.locale)
  ) {
    throw new Error('ai_invalid_arguments');
  }
  return { resourceId: args.resourceId, locale: args.locale as 'ru' | 'ro' };
}

/** Context must come from the authenticated server session. Handlers must scope
 * their resource queries by context.companyId and return proposals only. */
export async function executeTool(
  name: string,
  raw: string,
  context: ToolContext,
  handlers: ToolHandlers,
): Promise<unknown> {
  if (!context.userId || !context.companyId) throw new Error('ai_company_required');
  if (!TOOL_NAMES.some((candidate) => candidate === name)) throw new Error('ai_unknown_tool');
  const handler = handlers[name as ToolName];
  if (!handler) throw new Error('ai_tool_unavailable');
  return handler(parseToolArguments(raw), { ...context });
}
