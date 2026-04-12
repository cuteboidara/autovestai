import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    app.enableCors({
      origin:
        process.env.NODE_ENV === 'production'
          ? ['https://autovestai.io', 'https://www.autovestai.io']
          : ['http://localhost:3001', 'http://localhost:3000'],
      credentials: true,
    });
    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`✅ Application running on port ${port}`);
  } catch (error) {
    console.error('❌ FATAL startup error:', error);
    process.exit(1);
  }
}
bootstrap();
