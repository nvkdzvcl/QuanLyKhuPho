import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  NeighborhoodDetailSummaryDto,
  PetitionCategoryAnalyticsResponseDto,
  UserRole,
  WardOverviewDto,
} from '@quanlykhupho/shared-types';
import { AuthGuard } from '../security/guards/auth.guard';
import { RolesGuard } from '../security/guards/roles.guard';
import { Roles } from '../security/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardPetitionCategoriesQueryDto } from './dto/dashboard-petition-categories-query.dto';

@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.OFFICER)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * FR-17: Get Ward-level overview aggregates and per-neighborhood metrics.
   */
  @Get('ward-overview')
  @HttpCode(HttpStatus.OK)
  async getWardOverview(): Promise<WardOverviewDto> {
    return this.dashboardService.getWardOverview();
  }

  /**
   * FR-18: Get Neighborhood drill-down details, metrics, and recent items.
   */
  @Get('neighborhoods/:id')
  @HttpCode(HttpStatus.OK)
  async getNeighborhoodDrillDown(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NeighborhoodDetailSummaryDto> {
    return this.dashboardService.getNeighborhoodDrillDown(id);
  }

  /**
   * FR-19: Get Petition Category series analytics with optional filters.
   */
  @Get('petition-categories')
  @HttpCode(HttpStatus.OK)
  async getPetitionCategoryAnalytics(
    @Query() query: DashboardPetitionCategoriesQueryDto,
  ): Promise<PetitionCategoryAnalyticsResponseDto> {
    return this.dashboardService.getPetitionCategoryAnalytics(query);
  }
}
