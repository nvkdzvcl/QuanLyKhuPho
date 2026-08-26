import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthResponseDto,
  HealthStatus,
  LivenessResponseDto,
  ServiceHealth,
} from '@quanlykhupho/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly rabbitmqService: RabbitMQService,
  ) {}

  getLiveness(): LivenessResponseDto {
    return {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getHealth(): Promise<HealthResponseDto> {
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    const timeoutMs = this.configService.get<number>('HEALTH_PROBE_TIMEOUT_MS', 1000);

    const [database, redis, rabbitmq, deployment] = await Promise.all([
      this.probeDatabase(timeoutMs),
      this.probeRedis(timeoutMs),
      this.probeRabbitMQ(),
      this.probeDeployment(environment),
    ]);

    const status = this.calculateOverallStatus({ database, redis, rabbitmq, deployment });

    return {
      status,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      environment,
      services: {
        database,
        redis,
        rabbitmq,
        deployment,
      },
    };
  }

  private async probeDatabase(timeoutMs: number): Promise<ServiceHealth> {
    try {
      return await this.prismaService.ping(timeoutMs);
    } catch {
      return {
        status: 'down',
        message: 'Database connection unavailable',
      };
    }
  }

  private async probeRedis(timeoutMs: number): Promise<ServiceHealth> {
    try {
      return await this.redisService.ping(timeoutMs);
    } catch {
      return {
        status: 'down',
        message: 'Redis connection unavailable',
      };
    }
  }

  private async probeRabbitMQ(): Promise<ServiceHealth> {
    try {
      return await this.rabbitmqService.ping();
    } catch {
      return {
        status: 'down',
        message: 'RabbitMQ connection unavailable',
      };
    }
  }

  private async probeDeployment(environment: string): Promise<ServiceHealth> {
    const isProduction = environment === 'production';
    try {
      const profile = await this.prismaService.deploymentProfile.findUnique({
        where: { singletonKey: 'SINGLETON' },
        select: { confirmed: true },
      });

      if (!profile) {
        return {
          status: isProduction ? 'down' : 'degraded',
          message: isProduction
            ? 'Deployment profile is not initialized'
            : 'Deployment profile is uninitialized (non-production)',
        };
      }

      if (!profile.confirmed) {
        return {
          status: isProduction ? 'down' : 'degraded',
          message: isProduction
            ? 'Deployment profile is unconfirmed'
            : 'Deployment profile is unconfirmed (non-production)',
        };
      }

      return {
        status: 'ok',
        message: 'Deployment profile is confirmed',
      };
    } catch {
      return {
        status: isProduction ? 'down' : 'degraded',
        message: 'Deployment profile check unavailable',
      };
    }
  }

  private calculateOverallStatus(services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    rabbitmq: ServiceHealth;
    deployment: ServiceHealth;
  }): HealthStatus {
    const statuses = Object.values(services).map((service) => service.status);
    if (statuses.includes('down')) {
      return 'down';
    }

    if (statuses.includes('degraded')) {
      return 'degraded';
    }

    return 'ok';
  }
}
