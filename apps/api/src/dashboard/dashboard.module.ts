import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthModule } from '../auth/auth.module';
import { CryptoService } from '../security/crypto.service';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService, CryptoService],
  exports: [DashboardService],
})
export class DashboardModule {}
