import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AttachmentStorageService } from './attachment-storage.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoService } from '../security/crypto.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AnnouncementsController],
  providers: [
    AnnouncementsService,
    AttachmentStorageService,
    CryptoService,
  ],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
