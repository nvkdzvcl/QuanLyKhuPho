import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthModule } from '../auth/auth.module';
import { CryptoService } from '../security/crypto.service';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [AuthModule, ObservabilityModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, CryptoService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
