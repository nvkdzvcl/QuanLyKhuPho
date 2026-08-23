import { Module } from '@nestjs/common';
import { PetitionsController } from './petitions.controller';
import { PetitionsService } from './petitions.service';
import { PetitionEvidenceStorageService } from './petition-evidence-storage.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoService } from '../security/crypto.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [PetitionsController],
  providers: [
    PetitionsService,
    PetitionEvidenceStorageService,
    CryptoService,
  ],
  exports: [PetitionsService],
})
export class PetitionsModule {}
