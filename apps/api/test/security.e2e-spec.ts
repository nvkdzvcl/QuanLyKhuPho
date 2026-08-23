import 'reflect-metadata';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { configureTransportSecurity } from '../src/core/transport-security';

@Controller('probe')
class TransportProbeController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

async function createTransportApp(environment: 'development' | 'production') {
  const moduleFixture = await Test.createTestingModule({
    controllers: [TransportProbeController],
    providers: [
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, defaultValue?: unknown) => {
            if (key === 'NODE_ENV') return environment;
            if (key === 'TRUST_PROXY') return 'loopback';
            return defaultValue;
          },
        },
      },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureTransportSecurity(app, app.get(ConfigService));
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

describe('Transport security and proxy hardening (e2e)', () => {
  describe('development', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTransportApp('development');
    });

    afterAll(async () => {
      await app.close();
    });

    it('adds baseline headers without HSTS or framework disclosure', async () => {
      const response = await request(app.getHttpServer()).get('/api/probe').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(response.headers['permissions-policy']).toBe(
        'camera=(), microphone=(), geolocation=()',
      );
      expect(response.headers['strict-transport-security']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('production', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTransportApp('production');
    });

    afterAll(async () => {
      await app.close();
    });

    it('rejects every insecure HTTP request with a safe error envelope', async () => {
      const response = await request(app.getHttpServer()).get('/api/probe').expect(403);

      expect(response.body).toMatchObject({
        success: false,
        statusCode: 403,
        errorCode: 'FORBIDDEN',
        message: 'HTTPS connection is required',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('accepts HTTPS from the trusted proxy and sends HSTS', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/probe')
        .set('X-Forwarded-Proto', 'https')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
      expect(response.headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains',
      );
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});
