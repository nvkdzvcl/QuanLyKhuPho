import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeploymentInitializationService } from './deployment-initialization.service';
import { DeploymentProfileService } from './deployment-profile.service';
import { DeploymentProfileController } from './deployment-profile.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DeploymentProfileController],
  providers: [DeploymentInitializationService, DeploymentProfileService],
  exports: [DeploymentInitializationService, DeploymentProfileService],
})
export class DeploymentsModule {}
