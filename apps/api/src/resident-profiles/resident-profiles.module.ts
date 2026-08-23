import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CryptoService } from '../security/crypto.service';
import { ResidentProfilesController } from './resident-profiles.controller';
import { ResidentProfilesService } from './resident-profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [ResidentProfilesController],
  providers: [ResidentProfilesService, CryptoService],
  exports: [ResidentProfilesService],
})
export class ResidentProfilesModule {}
