import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              if (key === 'NODE_ENV') return 'test';
              return defaultValue;
            },
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should return health status matching HealthResponseDto', () => {
    const result = controller.check();
    expect(result).toBeDefined();
    expect(result.status).toBe('ok');
    expect(result.environment).toBe('test');
    expect(result.version).toBe('0.1.0');
    expect(result.timestamp).toBeDefined();
    expect(result.services.database?.status).toBe('ok');
    expect(result.services.redis?.status).toBe('ok');
    expect(result.services.rabbitmq?.status).toBe('ok');
  });
});
