import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { DeploymentInitializationService } from './deployment-initialization.service';
import { DeploymentProfileService } from './deployment-profile.service';
import { DeploymentProfileController } from './deployment-profile.controller';
import { DeploymentRuntimeGuard } from './deployment-runtime.guard';

@Module({
  imports: [PrismaModule],
  controllers: [DeploymentProfileController],
  providers: [
    DeploymentInitializationService,
    DeploymentProfileService,
    DeploymentRuntimeGuard,
    {
      provide: APP_GUARD,
      useExisting: DeploymentRuntimeGuard,
    },
  ],
  exports: [
    DeploymentInitializationService,
    DeploymentProfileService,
    DeploymentRuntimeGuard,
  ],
})
export class DeploymentsModule {}
