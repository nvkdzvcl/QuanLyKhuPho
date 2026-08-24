import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ApiResponseEnvelope,
  HealthResponseDto,
  isSystemHealthy,
} from '@quanlykhupho/shared-types';
import {
  fetchApiHealth,
  parseHealthResponse,
  fallbackHealth,
} from '../src/components/health-status';

describe('Health Status & Envelope Parsing', () => {
  describe('parseHealthResponse', () => {
    it('unwraps and normalizes a standard 200 OK ApiResponseEnvelope<HealthResponseDto>', () => {
      const envelope: ApiResponseEnvelope<HealthResponseDto> = {
        success: true,
        data: {
          status: 'ok',
          version: '0.1.0',
          timestamp: '2026-08-24T00:00:00.000Z',
          environment: 'production',
          services: {
            database: { status: 'ok', message: 'PostgreSQL sẵn sàng', latencyMs: 3 },
            redis: { status: 'ok', message: 'Redis sẵn sàng', latencyMs: 1 },
            rabbitmq: { status: 'ok', message: 'RabbitMQ sẵn sàng', latencyMs: 2 },
          },
        },
        timestamp: '2026-08-24T00:00:00.000Z',
      };

      const parsed = parseHealthResponse(envelope);

      expect(parsed.status).toBe('ok');
      expect(parsed.version).toBe('0.1.0');
      expect(parsed.environment).toBe('production');
      expect(parsed.timestamp).toBe('2026-08-24T00:00:00.000Z');
      expect(parsed.services.database?.status).toBe('ok');
      expect(parsed.services.database?.message).toBe('PostgreSQL sẵn sàng');
      expect(parsed.services.redis?.status).toBe('ok');
      expect(parsed.services.rabbitmq?.status).toBe('ok');
      expect(isSystemHealthy(parsed)).toBe(true);
    });

    it('unwraps a degraded/down 503 response envelope without throwing', () => {
      const degradedEnvelope: ApiResponseEnvelope<HealthResponseDto> = {
        success: true,
        data: {
          status: 'down',
          version: '0.1.0',
          timestamp: '2026-08-24T00:00:00.000Z',
          environment: 'production',
          services: {
            database: { status: 'down', message: 'PostgreSQL kết nối thất bại' },
            redis: { status: 'ok', message: 'Redis sẵn sàng' },
            rabbitmq: { status: 'down', message: 'RabbitMQ không phản hồi' },
          },
        },
        timestamp: '2026-08-24T00:00:00.000Z',
      };

      const parsed = parseHealthResponse(degradedEnvelope);

      expect(parsed.status).toBe('down');
      expect(parsed.services.database?.status).toBe('down');
      expect(parsed.services.redis?.status).toBe('ok');
      expect(parsed.services.rabbitmq?.status).toBe('down');
      expect(isSystemHealthy(parsed)).toBe(false);
    });

    it('supports direct unwrapped HealthResponseDto without envelope', () => {
      const directDto: HealthResponseDto = {
        status: 'ok',
        version: '0.2.0',
        timestamp: '2026-08-24T12:00:00.000Z',
        environment: 'staging',
        services: {
          database: { status: 'ok' },
          redis: { status: 'ok' },
          rabbitmq: { status: 'ok' },
        },
      };

      const parsed = parseHealthResponse(directDto);

      expect(parsed.status).toBe('ok');
      expect(parsed.version).toBe('0.2.0');
      expect(parsed.environment).toBe('staging');
      expect(parsed.services.database?.status).toBe('ok');
    });

    it('handles partial optional service health records gracefully', () => {
      const partialEnvelope = {
        success: true,
        data: {
          status: 'degraded',
          version: '0.1.0',
          timestamp: '2026-08-24T00:00:00.000Z',
          environment: 'development',
          services: {
            database: { status: 'ok' },
          },
        },
        timestamp: '2026-08-24T00:00:00.000Z',
      };

      const parsed = parseHealthResponse(partialEnvelope);

      expect(parsed.status).toBe('degraded');
      expect(parsed.services.database?.status).toBe('ok');
      expect(parsed.services.redis).toBeUndefined();
      expect(parsed.services.rabbitmq).toBeUndefined();
      expect(isSystemHealthy(parsed)).toBe(false);
    });

    it('fills default values for missing string metadata when unwrapping valid services', () => {
      const minimal = {
        success: true,
        data: {
          status: 'ok',
          services: {},
        },
      };

      const parsed = parseHealthResponse(minimal);

      expect(parsed.status).toBe('ok');
      expect(parsed.version).toBe('0.1.0');
      expect(parsed.environment).toBe('Không xác định');
      expect(typeof parsed.timestamp).toBe('string');
    });

    it('throws error for null, undefined, or primitive payloads', () => {
      expect(() => parseHealthResponse(null)).toThrow(
        'Phản hồi trạng thái hệ thống không hợp lệ',
      );
      expect(() => parseHealthResponse(undefined)).toThrow(
        'Phản hồi trạng thái hệ thống không hợp lệ',
      );
      expect(() => parseHealthResponse('ok')).toThrow(
        'Phản hồi trạng thái hệ thống không hợp lệ',
      );
      expect(() => parseHealthResponse(123)).toThrow(
        'Phản hồi trạng thái hệ thống không hợp lệ',
      );
    });

    it('throws error on empty object or missing status', () => {
      expect(() => parseHealthResponse({})).toThrow(
        'Trạng thái hệ thống không hợp lệ',
      );
      expect(() => parseHealthResponse({ data: {} })).toThrow(
        'Trạng thái hệ thống không hợp lệ',
      );
    });

    it('throws error on ApiErrorEnvelope payloads', () => {
      const errorEnvelope = {
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
        timestamp: '2026-08-24T00:00:00.000Z',
      };

      expect(() => parseHealthResponse(errorEnvelope)).toThrow(
        'Trạng thái hệ thống không hợp lệ',
      );
    });

    it('throws error on invalid status values', () => {
      expect(() =>
        parseHealthResponse({
          data: {
            status: 'healthy',
            services: {},
          },
        }),
      ).toThrow('Trạng thái hệ thống không hợp lệ');
    });

    it('throws error when services object is missing or null', () => {
      expect(() =>
        parseHealthResponse({
          data: {
            status: 'ok',
          },
        }),
      ).toThrow('Thông tin dịch vụ hạ tầng không hợp lệ');

      expect(() =>
        parseHealthResponse({
          data: {
            status: 'ok',
            services: null,
          },
        }),
      ).toThrow('Thông tin dịch vụ hạ tầng không hợp lệ');
    });
  });

  describe('fetchApiHealth', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('fetches and unwraps successfully on HTTP 200', async () => {
      const mockEnvelope: ApiResponseEnvelope<HealthResponseDto> = {
        success: true,
        data: {
          status: 'ok',
          version: '0.1.0',
          timestamp: '2026-08-24T00:00:00.000Z',
          environment: 'development',
          services: {
            database: { status: 'ok', message: 'PostgreSQL sẵn sàng' },
            redis: { status: 'ok', message: 'Redis sẵn sàng' },
            rabbitmq: { status: 'ok', message: 'RabbitMQ sẵn sàng' },
          },
        },
        timestamp: '2026-08-24T00:00:00.000Z',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockEnvelope,
      } as unknown as Response);

      const result = await fetchApiHealth('http://localhost:4000/api');

      expect(result.status).toBe('ok');
      expect(result.services.database?.status).toBe('ok');
      expect(result.services.redis?.status).toBe('ok');
      expect(result.services.rabbitmq?.status).toBe('ok');
    });

    it('fetches and unwraps degraded data on HTTP 503 carrying a valid health envelope', async () => {
      const mock503Envelope: ApiResponseEnvelope<HealthResponseDto> = {
        success: true,
        data: {
          status: 'down',
          version: '0.1.0',
          timestamp: '2026-08-24T00:00:00.000Z',
          environment: 'production',
          services: {
            database: { status: 'down', message: 'PostgreSQL kết nối thất bại' },
            redis: { status: 'ok', message: 'Redis sẵn sàng' },
            rabbitmq: { status: 'ok', message: 'RabbitMQ sẵn sàng' },
          },
        },
        timestamp: '2026-08-24T00:00:00.000Z',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => mock503Envelope,
      } as unknown as Response);

      const result = await fetchApiHealth('http://localhost:4000/api');

      expect(result.status).toBe('down');
      expect(result.services.database?.status).toBe('down');
      expect(result.services.redis?.status).toBe('ok');
      expect(result.services.rabbitmq?.status).toBe('ok');
      expect(isSystemHealthy(result)).toBe(false);
    });

    it('throws descriptive error on unexpected HTTP status codes (e.g. 500, 404)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          statusCode: 500,
          message: 'Internal server error',
          timestamp: '2026-08-24T00:00:00.000Z',
        }),
      } as unknown as Response);

      await expect(
        fetchApiHealth('http://localhost:4000/api'),
      ).rejects.toThrow('HTTP error! status: 500');
    });

    it('throws error on HTTP 503 when response body is not a valid health payload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          success: false,
          statusCode: 503,
          message: 'Service Unavailable',
          timestamp: '2026-08-24T00:00:00.000Z',
        }),
      } as unknown as Response);

      await expect(
        fetchApiHealth('http://localhost:4000/api'),
      ).rejects.toThrow();
    });

    it('throws error when network fetch rejects', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection failed'));

      await expect(
        fetchApiHealth('http://localhost:4000/api'),
      ).rejects.toThrow('Network connection failed');
    });
  });

  describe('fallbackHealth and invariant checks', () => {
    it('provides a safe down state with all three core infrastructure services declared down', () => {
      expect(fallbackHealth.status).toBe('down');
      expect(fallbackHealth.services.database?.status).toBe('down');
      expect(fallbackHealth.services.redis?.status).toBe('down');
      expect(fallbackHealth.services.rabbitmq?.status).toBe('down');
      expect(isSystemHealthy(fallbackHealth)).toBe(false);
    });
  });
});
