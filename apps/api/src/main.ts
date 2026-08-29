import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './core/exceptions/http-exception.filter';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { configureTransportSecurity } from './core/transport-security';
import { SmsWorkerService } from './rabbitmq/sms-publisher.service';
import { UsersService } from './users/users.service';
import { DeploymentInitializationService } from './deployments/deployment-initialization.service';

async function bootstrap() {
  const isWorkerMode = process.argv.includes('--worker') || process.env.RUN_SMS_WORKER === 'true';
  const isBootstrapOfficerMode =
    process.argv.includes('--bootstrap-officer') ||
    process.argv.includes('bootstrap:officer') ||
    process.env.RUN_BOOTSTRAP_OFFICER === 'true';
  const isDeploymentInitMode =
    process.argv.includes('--deployment-init') ||
    process.argv.includes('deployment:init');

  // 1. Standalone SMS Worker Mode
  if (isWorkerMode) {
    const logger = new Logger('SmsWorkerProcess');
    logger.log('Initializing SMS delivery worker process...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const workerService = app.get(SmsWorkerService);
    await workerService.startConsumer();
    logger.log('SMS delivery worker started and consuming queue');

    const shutdown = async (signal: string) => {
      logger.log(`Received ${signal}, shutting down SMS worker gracefully...`);
      await workerService.stopConsumer();
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    return;
  }

  // 2. One-time Officer Bootstrap Mode
  if (isBootstrapOfficerMode) {
    const logger = new Logger('BootstrapOfficerCommand');
    logger.log('Starting officer bootstrap procedure...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);

    try {
      const result = await usersService.bootstrapOfficer();
      logger.log(
        `Officer bootstrap complete: ID=${result.id}, Name=${result.fullName}, Status=${result.status}, Role=${result.role}, MaskedPhone=${result.maskedPhone}, isExisting=${result.isExisting}`,
      );
      await app.close();
      process.exit(0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Officer bootstrap failed: ${errorMsg}`);
      await app.close();
      process.exit(1);
    }
  }

  // 3. Deployment Profile Initializer CLI Mode
  if (isDeploymentInitMode) {
    const logger = new Logger('DeploymentInitCommand');
    logger.log('Starting deployment initialization command...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const initService = app.get(DeploymentInitializationService);

    try {
      // Find --profile argument
      const profileIndex = process.argv.indexOf('--profile');
      let profileInput: string | undefined;
      if (profileIndex !== -1 && process.argv[profileIndex + 1]) {
        profileInput = process.argv[profileIndex + 1];
      } else {
        const pArg = process.argv.find((a) => a.startsWith('--profile='));
        if (pArg) {
          profileInput = pArg.split('=')[1];
        } else {
          profileInput = process.env.DEPLOYMENT_PROFILE;
        }
      }

      if (!profileInput || profileInput.trim().length === 0) {
        logger.error('Missing required argument: --profile <slug_or_path>');
        await app.close();
        process.exit(1);
      }

      const shouldApply = process.argv.includes('--apply');

      const result = await initService.initializeDeployment({
        slug: profileInput.trim(),
        apply: shouldApply,
      });

      logger.log(
        `Deployment initialization completed: slug=${result.slug}, locality=${result.localityName}, dryRun=${result.dryRun}, confirmed=${result.confirmed}, created=${result.neighborhoodsCreated}, updated=${result.neighborhoodsUpdated}`,
      );
      await app.close();
      process.exit(0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Deployment initialization failed: ${errorMsg}`);
      await app.close();
      process.exit(1);
    }
  }

  // 4. Default HTTP API Server Mode
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown hooks for clean termination of services & connections
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';
  const port = configService.get<number>('PORT', 4000);
  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000',
  );

  // Transport security: proxy trust, security headers, HTTPS enforcement, remove X-Powered-By
  configureTransportSecurity(app, configService);

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
  const allowedOrigins = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
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
    exposedHeaders: ['Content-Disposition'],
  });

  await app.listen(port);
  if (isProduction) {
    logger.log(`QuanLyKhuPho API server listening on port ${port} (prefix: /api)`);
  } else {
    logger.log(`QuanLyKhuPho API running on port ${port} (prefix: /api)`);
  }
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  const errorName = err instanceof Error ? err.name : 'UnknownError';
  logger.error(`Fatal error during application startup (${errorName})`);
  process.exit(1);
});
