import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthResponseDto } from '@quanlykhupho/shared-types';

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  getHealth(): HealthResponseDto {
    const environment = this.configService.get<string>('NODE_ENV', 'development');

    return {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      environment,
      services: {
        database: {
          status: 'ok',
          message: 'Ready for connection (Phase 0 mock)',
        },
        redis: {
          status: 'ok',
          message: 'Ready for connection (Phase 0 mock)',
        },
        rabbitmq: {
          status: 'ok',
          message: 'Ready for connection (Phase 0 mock)',
        },
      },
    };
  }
}
