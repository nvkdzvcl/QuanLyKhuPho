import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ServiceHealth } from '@quanlykhupho/shared-types';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to PostgreSQL database');
    } catch (err) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        this.logger.error('PostgreSQL connection failed');
        throw new Error('PostgreSQL connection failed', { cause: err });
      }
      this.logger.warn('PostgreSQL connection unavailable in development/test mode');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async ping(timeoutMs = 3000): Promise<ServiceHealth> {
    const start = Date.now();
    let timer: NodeJS.Timeout | null = null;

    try {
      const queryPromise = this.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Database probe timed out'));
        }, timeoutMs);
      });

      await Promise.race([queryPromise, timeoutPromise]);
      const latencyMs = Date.now() - start;
      return {
        status: 'ok',
        latencyMs,
        message: 'PostgreSQL connection is healthy',
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const isTimeout = err instanceof Error && err.message === 'Database probe timed out';
      return {
        status: 'down',
        latencyMs,
        message: isTimeout ? 'Database check timed out' : 'Database connection unavailable',
      };
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
