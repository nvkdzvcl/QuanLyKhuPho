import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoService } from '../security/crypto.service';
import { NeighborhoodActivitiesController } from './neighborhood-activities.controller';
import { NeighborhoodActivitiesService } from './neighborhood-activities.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NeighborhoodActivitiesController],
  providers: [NeighborhoodActivitiesService, CryptoService],
  exports: [NeighborhoodActivitiesService],
})
export class NeighborhoodActivitiesModule {}
