import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Request, Response } from 'express';

/// Anything at or above this is our fault and goes to Sentry; anything below
/// is the caller's and is expected traffic.
const SERVER_ERROR = 500;

interface ErrorBody {
  statusCode: number;
  /// Stable machine code the client maps to a translated sentence.
  code: string;
  message: string;
  path: string;
  timestamp: string;
}

/// Registered BEFORE any narrower filter. NestJS applies APP_FILTER providers in
/// reverse order, so a catch-all listed last would swallow every 404 as a 500.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : SERVER_ERROR;
    const body: ErrorBody = {
      statusCode: status,
      code: resolveCode(exception, status),
      message: resolveMessage(exception, status),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    // 4xx is expected traffic and would drown the issue feed. Only 5xx reports.
    if (status >= SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : '',
      );
      Sentry.captureException(exception);
    }

    response.status(status).json(body);
  }
}

function resolveCode(exception: unknown, status: number): string {
  if (exception instanceof HttpException) {
    const payload = exception.getResponse();

    if (typeof payload === 'object' && payload !== null && 'code' in payload) {
      const { code } = payload;

      if (typeof code === 'string') {
        return code;
      }
    }
  }

  return status >= SERVER_ERROR ? 'internal_error' : 'request_error';
}

function resolveMessage(exception: unknown, status: number): string {
  if (status >= SERVER_ERROR) {
    // Never leak a stack trace or a driver message to the caller.
    return 'Internal server error';
  }

  if (exception instanceof HttpException) {
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return payload;
    }

    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const { message } = payload;

      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message)) {
        return message.join('; ');
      }
    }
  }

  return 'Request error';
}
