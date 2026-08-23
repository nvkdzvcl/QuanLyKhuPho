import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import type { Response } from 'express';

describe('HealthController and HealthService', () => {
  let controller: HealthController;
  let service: HealthService;
  let prismaService: { ping: ReturnType<typeof vi.fn> };
  let redisService: { ping: ReturnType<typeof vi.fn> };
  let rabbitmqService: { ping: ReturnType<typeof vi.fn> };
  let response: Response;

  beforeEach(async () => {
    prismaService = {
      ping: vi.fn().mockResolvedValue({
        status: 'ok',
        latencyMs: 3,
        message: 'PostgreSQL connection is healthy',
      }),
    };
    redisService = {
      ping: vi.fn().mockResolvedValue({
        status: 'ok',
        latencyMs: 1,
        message: 'Redis connection is healthy',
      }),
    };
    rabbitmqService = {
      ping: vi.fn().mockResolvedValue({
        status: 'ok',
        latencyMs: 2,
        message: 'RabbitMQ connection is healthy',
      }),
    };
    response = {
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: unknown) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'HEALTH_PROBE_TIMEOUT_MS') return 3000;
              return defaultValue;
            },
          },
        },
        { provide: PrismaService, useValue: prismaService },
        { provide: RedisService, useValue: redisService },
        { provide: RabbitMQService, useValue: rabbitmqService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('Liveness', () => {
    it('returns ok status immediately without calling external dependencies', () => {
      const live = controller.live();

      expect(live.status).toBe('ok');
      expect(live.version).toBe('0.1.0');
      expect(typeof live.timestamp).toBe('string');
      expect(typeof live.uptimeSeconds).toBe('number');
      expect(live.uptimeSeconds).toBeGreaterThanOrEqual(0);

      expect(prismaService.ping).not.toHaveBeenCalled();
      expect(redisService.ping).not.toHaveBeenCalled();
      expect(rabbitmqService.ping).not.toHaveBeenCalled();
    });
  });

  describe('Readiness and Health', () => {
    it('returns overall ok when all dependencies are healthy', async () => {
      const result = await controller.check(response);

      expect(result.status).toBe('ok');
      expect(result.environment).toBe('test');
      expect(result.version).toBe('0.1.0');
      expect(result.timestamp).toBeDefined();
      expect(result.services.database?.status).toBe('ok');
      expect(result.services.database?.latencyMs).toBe(3);
      expect(result.services.redis?.status).toBe('ok');
      expect(result.services.redis?.latencyMs).toBe(1);
      expect(result.services.rabbitmq?.status).toBe('ok');
      expect(result.services.rabbitmq?.latencyMs).toBe(2);

      const readyResult = await controller.ready(response);
      expect(readyResult.status).toBe('ok');
      expect(response.status).not.toHaveBeenCalled();
    });

    it('returns degraded when dependencies run in development/test fallback mode', async () => {
      redisService.ping.mockResolvedValue({
        status: 'degraded',
        message: 'In-memory fallback active (Redis is not connected)',
      });
      rabbitmqService.ping.mockResolvedValue({
        status: 'degraded',
        message: 'In-memory fallback active (RabbitMQ is not connected)',
      });

      const result = await service.getHealth();

      expect(result.status).toBe('degraded');
      expect(result.services.database?.status).toBe('ok');
      expect(result.services.redis?.status).toBe('degraded');
      expect(result.services.rabbitmq?.status).toBe('degraded');
    });

    it('returns down when a required dependency is down', async () => {
      redisService.ping.mockResolvedValue({
        status: 'down',
        message: 'Redis connection unavailable',
      });

      const result = await controller.ready(response);

      expect(result.status).toBe('down');
      expect(result.services.database?.status).toBe('ok');
      expect(result.services.redis?.status).toBe('down');
      expect(result.services.rabbitmq?.status).toBe('ok');
      expect(response.status).toHaveBeenCalledWith(503);
    });

    it('returns down when Database is down', async () => {
      prismaService.ping.mockResolvedValue({
        status: 'down',
        message: 'Database connection unavailable',
      });

      const result = await service.getHealth();

      expect(result.status).toBe('down');
      expect(result.services.database?.status).toBe('down');
      expect(result.services.redis?.status).toBe('ok');
      expect(result.services.rabbitmq?.status).toBe('ok');
    });

    it('handles probe timeouts safely with bounded error messages', async () => {
      prismaService.ping.mockResolvedValue({
        status: 'down',
        latencyMs: 3000,
        message: 'Database check timed out',
      });
      redisService.ping.mockResolvedValue({
        status: 'down',
        latencyMs: 3000,
        message: 'Redis check timed out',
      });

      const result = await service.getHealth();

      expect(result.status).toBe('down');
      expect(result.services.database?.message).toBe('Database check timed out');
      expect(result.services.redis?.message).toBe('Redis check timed out');
      expect(result.services.database?.status).toBe('down');
      expect(result.services.redis?.status).toBe('down');
    });

    it('handles unexpected probe rejections safely without leaking secrets or crashing', async () => {
      prismaService.ping.mockRejectedValue(new Error('Sensitive raw connection string'));
      redisService.ping.mockRejectedValue(new Error('redis://user:pass@secret:6379'));
      rabbitmqService.ping.mockRejectedValue(new Error('amqp://user:pass@secret:5672'));

      const result = await service.getHealth();

      expect(result.status).toBe('down');
      expect(result.services.database?.status).toBe('down');
      expect(result.services.database?.message).toBe('Database connection unavailable');
      expect(result.services.redis?.status).toBe('down');
      expect(result.services.redis?.message).toBe('Redis connection unavailable');
      expect(result.services.rabbitmq?.status).toBe('down');
      expect(result.services.rabbitmq?.message).toBe('RabbitMQ connection unavailable');
      expect(JSON.stringify(result)).not.toContain('secret');
      expect(JSON.stringify(result)).not.toContain('Sensitive');
    });
  });
});
