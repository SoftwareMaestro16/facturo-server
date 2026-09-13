import { explain } from '../../efactura/model/error-catalogue';
import type { ToolHandler } from './tool-registry';

export interface RejectionResource {
  id: string;
  companyId: string;
  errorCode: string | null;
}

/** Adapter must recheck membership and query by BOTH id and companyId.
 * No raw invoice XML, customer names or amounts enter this tool's output. */
export type RejectionReader = (scope: {
  userId: string;
  companyId: string;
  resourceId: string;
}) => Promise<RejectionResource | null>;

export function createRejectionTool(read: RejectionReader): ToolHandler {
  return async (args, context) => {
    const resource = await read({ ...context, resourceId: args.resourceId });
    if (!resource || resource.companyId !== context.companyId || resource.id !== args.resourceId) {
      throw new Error('ai_resource_not_found');
    }
    if (!resource.errorCode) return { status: 'no_rejection', source: 'catalogue', requiresReview: true };
    const entry = explain(resource.errorCode);
    if (entry.code === 'efactura_unknown_error') {
      return { status: 'needs_review', source: 'catalogue', requiresReview: true };
    }
    return {
      status: 'explained',
      source: 'catalogue',
      code: entry.code,
      explanation: entry[args.locale],
      field: entry.field ?? null,
      retryable: entry.retryable,
      requiresReview: true,
    };
  };
}
