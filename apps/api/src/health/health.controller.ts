import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthResponseDto } from '@quanlykhupho/shared-types';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  check(): HealthResponseDto {
    return this.healthService.getHealth();
  }
}
