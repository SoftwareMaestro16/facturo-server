import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/// Prisma returns Decimal objects that serialise to "25" for a stored 25.00.
/// The client then renders "25 L" where the bank statement says "25,00 L".
/// Every Decimal leaving the API is turned into a fixed-scale string here, once,
/// rather than remembered at each call site.
@Injectable()
export class DecimalSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => serialize(value)));
  }
}

/// Quantities carry three decimals, money carries two. Scale is decided by the
/// field name because that is the only signal the value itself does not carry.
const THREE_DECIMAL_FIELDS = new Set(['quantity']);

function serialize(value: unknown, key?: string): unknown {
  if (Prisma.Decimal.isDecimal(value)) {
    return value.toFixed(key !== undefined && THREE_DECIMAL_FIELDS.has(key) ? 3 : 2);
  }

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item, key));
  }

  if (value instanceof Date || value === null || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([field, fieldValue]) => [
      field,
      serialize(fieldValue, field),
    ]),
  );
}
