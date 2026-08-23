import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureTransportSecurity } from '../src/core/transport-security';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const configService = app.get(ConfigService);
    configureTransportSecurity(app, configService);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health (GET) returns truthful readiness and baseline security headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/health');

    expect(['ok', 'degraded', 'down']).toContain(response.body.status);
    expect(response.status).toBe(response.body.status === 'down' ? 503 : 200);
    expect(response.body).toHaveProperty('version', '0.1.0');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('environment');
    expect(response.body).toHaveProperty('services');
    expect(response.body.services).toHaveProperty('database');
    expect(response.body.services).toHaveProperty('redis');
    expect(response.body.services).toHaveProperty('rabbitmq');

    // Security headers & framework disclosure checks
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('/api/health/live (GET) sends security headers without framework disclosure', async () => {
    const resLive = await request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200);

    expect(resLive.body).toHaveProperty('status', 'ok');
    expect(resLive.body).toHaveProperty('version', '0.1.0');
    expect(resLive.body).toHaveProperty('timestamp');
    expect(resLive.body).toHaveProperty('uptimeSeconds');
    expect(typeof resLive.body.uptimeSeconds).toBe('number');

    expect(resLive.headers['x-content-type-options']).toBe('nosniff');
    expect(resLive.headers['x-frame-options']).toBe('DENY');
    expect(resLive.headers['x-powered-by']).toBeUndefined();
  });

  it('/api/health/ready (GET)', async () => {
    const resReady = await request(app.getHttpServer()).get('/api/health/ready');

    expect(['ok', 'degraded', 'down']).toContain(resReady.body.status);
    expect(resReady.status).toBe(resReady.body.status === 'down' ? 503 : 200);
    expect(resReady.body).toHaveProperty('services');
  });
});
