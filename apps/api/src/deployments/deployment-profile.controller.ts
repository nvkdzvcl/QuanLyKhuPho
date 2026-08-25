import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { DeploymentProfileResponseDto } from '@quanlykhupho/shared-types';
import { Public } from '../security/decorators/public.decorator';
import { DeploymentProfileService } from './deployment-profile.service';

@Controller('deployment-profile')
export class DeploymentProfileController {
  constructor(
    private readonly deploymentProfileService: DeploymentProfileService,
  ) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getDeploymentProfile(): Promise<DeploymentProfileResponseDto> {
    return this.deploymentProfileService.getPublicProfile();
  }
}
