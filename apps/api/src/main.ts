import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './core/exceptions/http-exception.filter';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000',
  );

  // Cookie parser middleware for HttpOnly session cookies
  app.use(cookieParser());

  // Global /api prefix
  app.setGlobalPrefix('api');

  // Global response interceptor and exception filter
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration from environment
  const allowedOrigins = corsOrigin.split(',').map((origin) => origin.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Requested-With',
      'X-XSRF-TOKEN',
    ],
  });

  await app.listen(port);
  logger.log(`QuanLyKhuPho API running on http://localhost:${port}/api`);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  const errorName = err instanceof Error ? err.name : 'UnknownError';
  logger.error(`Fatal error during application startup (${errorName})`);
  process.exit(1);
});
