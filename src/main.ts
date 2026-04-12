import 'reflect-metadata';

import * as compression from 'compression';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import helmet from 'helmet';
import Redis from 'ioredis';
import { join } from 'path';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { StructuredLoggerService } from './common/logging/structured-logger.service';
import { RequestContextService } from './common/request-context/request-context.service';

function getNodeEnv(): string {
  return process.env.NODE_ENV?.trim().toLowerCase() || 'development';
}

function getRedisUrl(): string {
  return process.env.REDIS_URL?.trim() || 'redis://localhost:6379';
}

function isRedisRequiredOnStartup(): boolean {
  const configured = process.env.REDIS_REQUIRED_ON_STARTUP?.trim().toLowerCase();

  if (configured === 'true') {
    return true;
  }

  if (configured === 'false') {
    return false;
  }

  return getNodeEnv() === 'production';
}

function formatRedisStartupError(error: unknown): string {
  if (error instanceof AggregateError) {
    const nested = error.errors
      .map((entry) => (entry instanceof Error ? entry.message : String(entry)))
      .filter(Boolean);

    if (nested.length > 0) {
      return nested.join(' | ');
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function verifyRedisConnection(redisUrl: string): Promise<void> {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 5_000,
    retryStrategy: () => null,
  });

  client.on('error', () => undefined);

  try {
    await client.connect();
    const response = await client.ping();

    if (response !== 'PONG') {
      throw new Error(`Unexpected Redis ping response: ${response}`);
    }
  } catch (error) {
    throw new Error(
      [
        'Redis is unreachable on startup.',
        `REDIS_URL=${redisUrl}`,
        'Local development should use redis://localhost:6379.',
        'Docker Compose should use redis://redis:6379.',
        `Original error: ${formatRedisStartupError(error)}`,
      ].join(' '),
    );
  } finally {
    client.disconnect();
  }
}

async function bootstrap(): Promise<void> {
  const redisUrl = getRedisUrl();

  try {
    await verifyRedisConnection(redisUrl);
  } catch (error) {
    if (isRedisRequiredOnStartup()) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      [
        `Redis startup check failed in ${getNodeEnv()}.`,
        'Continuing with degraded readiness until Redis becomes available.',
        message,
      ].join(' '),
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  const logger = app.get(StructuredLoggerService);
  const requestContextService = app.get(RequestContextService);
  const uploadsRoot = join(
    process.cwd(),
    configService.get<string>('uploads.rootDir') ?? 'uploads',
  );

  mkdirSync(uploadsRoot, { recursive: true });

  app.useLogger(logger);
  app.enableCors({
    origin: configService.getOrThrow<string[]>('app.corsOrigins'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Device-Fingerprint'],
  });

  if (configService.get<boolean>('security.helmetEnabled')) {
    app.use(helmet());
  }

  app.use(compression({ threshold: 1024 }));

  app.use(
    (
      request: {
        headers: Record<string, string | string[] | undefined>;
        ip?: string;
        socket?: { remoteAddress?: string };
      },
      response: { setHeader: (key: string, value: string) => void },
      next: () => void,
    ) => {
      const requestId = request.headers['x-request-id']?.toString() ?? randomUUID();

      request.headers['x-request-id'] = requestId;
      response.setHeader('x-request-id', requestId);

      requestContextService.run(
        {
          requestId,
          ipAddress:
            request.ip ??
            request.socket?.remoteAddress ??
            request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim(),
          userAgent: request.headers['user-agent']?.toString(),
          deviceFingerprint: request.headers['x-device-fingerprint']?.toString(),
        },
        next,
      );
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(configService));
  app.useStaticAssets(uploadsRoot, {
    prefix: '/uploads/',
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port ${port}`);
}

void bootstrap().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`FATAL: Application failed to start: ${message}`);
  process.exit(1);
});
