import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';
import { HealthResponseDto, LivenessResponseDto } from '@quanlykhupho/shared-types';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthResponseDto> {
    return this.getReadiness(response);
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<HealthResponseDto> {
    return this.getReadiness(response);
  }

  @Get('live')
  live(): LivenessResponseDto {
    return this.healthService.getLiveness();
  }

  private async getReadiness(response: Response): Promise<HealthResponseDto> {
    const health = await this.healthService.getHealth();
    if (health.status === 'down') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}
