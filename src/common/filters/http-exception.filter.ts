import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = this.configService.get<string>('app.env') === 'production';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload
        ? (payload as { message?: unknown }).message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message:
        status >= 500 && isProduction ? 'Internal server error' : message,
      requestId: request.headers['x-request-id'],
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
