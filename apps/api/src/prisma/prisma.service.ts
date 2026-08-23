import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

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
}
