import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateNeighborhoodActivityResponseDto,
  NeighborhoodActivityDetailDto,
  NeighborhoodActivityListResponseDto,
  UserDto,
} from '@quanlykhupho/shared-types';
import { AuthGuard } from '../security/guards/auth.guard';
import { CsrfGuard } from '../security/guards/csrf.guard';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { NeighborhoodActivitiesService } from './neighborhood-activities.service';
import { CreateNeighborhoodActivityDto } from './dto/create-neighborhood-activity.dto';
import { UpdateNeighborhoodActivityDto } from './dto/update-neighborhood-activity.dto';
import { BatchUpdateParticipantsDto } from './dto/batch-update-participants.dto';
import { NeighborhoodActivityMonthlyQueryDto } from './dto/neighborhood-activity-monthly-query.dto';

@Controller('neighborhood-activities')
@UseGuards(AuthGuard, CsrfGuard)
export class NeighborhoodActivitiesController {
  constructor(
    private readonly neighborhoodActivitiesService: NeighborhoodActivitiesService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: UserDto,
    @Body() dto: CreateNeighborhoodActivityDto,
  ): Promise<CreateNeighborhoodActivityResponseDto> {
    return this.neighborhoodActivitiesService.create(user, dto);
  }

  @Get('monthly')
  async findMonthly(
    @CurrentUser() user: UserDto,
    @Query() query: NeighborhoodActivityMonthlyQueryDto,
  ): Promise<NeighborhoodActivityListResponseDto> {
    return this.neighborhoodActivitiesService.findAllMonthly(user, query);
  }

  @Get()
  async findAll(
    @CurrentUser() user: UserDto,
    @Query() query: NeighborhoodActivityMonthlyQueryDto,
  ): Promise<NeighborhoodActivityListResponseDto> {
    return this.neighborhoodActivitiesService.findAllMonthly(user, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
  ): Promise<NeighborhoodActivityDetailDto> {
    return this.neighborhoodActivitiesService.findOne(user, id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
    @Body() dto: UpdateNeighborhoodActivityDto,
  ): Promise<NeighborhoodActivityDetailDto> {
    return this.neighborhoodActivitiesService.update(user, id, dto);
  }

  @Put(':id/participants')
  async updateParticipantsPut(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
    @Body() dto: BatchUpdateParticipantsDto,
  ): Promise<NeighborhoodActivityDetailDto> {
    return this.neighborhoodActivitiesService.batchUpdateParticipants(
      user,
      id,
      dto,
    );
  }

  @Patch(':id/participants')
  async updateParticipantsPatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
    @Body() dto: BatchUpdateParticipantsDto,
  ): Promise<NeighborhoodActivityDetailDto> {
    return this.neighborhoodActivitiesService.batchUpdateParticipants(
      user,
      id,
      dto,
    );
  }
}
