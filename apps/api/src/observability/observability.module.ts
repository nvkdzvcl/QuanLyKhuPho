import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { OperationalMetricsService } from './operational-metrics.service';
import { OperationalMetricsInterceptor } from './operational-metrics.interceptor';
import { ObservabilityController } from './observability.controller';
import { CryptoService } from '../security/crypto.service';

@Module({
  imports: [AuthModule],
  controllers: [ObservabilityController],
  providers: [
    OperationalMetricsService,
    OperationalMetricsInterceptor,
    CryptoService,
    {
      provide: APP_INTERCEPTOR,
      useExisting: OperationalMetricsInterceptor,
    },
  ],
  exports: [OperationalMetricsService, OperationalMetricsInterceptor],
})
export class ObservabilityModule {}
