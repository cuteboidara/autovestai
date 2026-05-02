import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    app.enableCors({
      origin: [
        'https://autovestai.io',
        'https://www.autovestai.io',
        'https://autovestai.vercel.app',
        process.env.FRONTEND_URL,
      ].filter((v): v is string => Boolean(v)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Device-Fingerprint', 'X-Admin-Path'],
    });
    const port = Number(process.env.PORT) || 3000;
    await app.listen(port, '0.0.0.0');
    logger.log(`Application running on port ${port}`);
  } catch (error) {
    logger.error('FATAL startup error', error);
    process.exit(1);
  }
}
bootstrap();
