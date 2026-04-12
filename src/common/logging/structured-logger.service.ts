import {
  ConsoleLogger,
  Injectable,
  LoggerService,
} from '@nestjs/common';

@Injectable()
export class StructuredLoggerService
  extends ConsoleLogger
  implements LoggerService
{
  log(message: unknown, context?: string): void {
    super.log(this.format('log', message, context));
  }

  error(message: unknown, trace?: string, context?: string): void {
    super.error(this.format('error', message, context), trace);
  }

  warn(message: unknown, context?: string): void {
    super.warn(this.format('warn', message, context));
  }

  debug(message: unknown, context?: string): void {
    super.debug(this.format('debug', message, context));
  }

  verbose(message: unknown, context?: string): void {
    super.verbose(this.format('verbose', message, context));
  }

  private format(level: string, message: unknown, context?: string) {
    return JSON.stringify({
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}
