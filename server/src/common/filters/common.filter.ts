import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let detail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();
      if (typeof raw === 'string') {
        message = raw;
      } else if (typeof raw === 'object' && raw !== null) {
        const obj = raw as Record<string, unknown>;
        message = (obj.message as string) || exception.message;
        detail = obj.detail as string | undefined;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body = {
      statusCode: status,
      message,
      ...(detail ? { detail } : {}),
    };

    res.status(status).json(body);
  }
}
