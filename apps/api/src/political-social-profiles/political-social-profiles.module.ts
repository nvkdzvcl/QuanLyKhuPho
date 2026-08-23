import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoService } from '../security/crypto.service';
import { PoliticalSocialProfilesController } from './political-social-profiles.controller';
import { PoliticalSocialProfilesService } from './political-social-profiles.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PoliticalSocialProfilesController],
  providers: [PoliticalSocialProfilesService, CryptoService],
  exports: [PoliticalSocialProfilesService],
})
export class PoliticalSocialProfilesModule {}
