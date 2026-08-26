import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  OperationalMetricsSnapshotDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AuthGuard } from '../security/guards/auth.guard';
import { RolesGuard } from '../security/guards/roles.guard';
import { Roles } from '../security/decorators/roles.decorator';
import { OperationalMetricsService } from './operational-metrics.service';

@Controller('observability')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.OFFICER)
export class ObservabilityController {
  constructor(
    private readonly metricsService: OperationalMetricsService,
  ) {}

  @Get('operational-metrics')
  @HttpCode(HttpStatus.OK)
  getOperationalMetrics(): OperationalMetricsSnapshotDto {
    return this.metricsService.getSnapshot();
  }
}
