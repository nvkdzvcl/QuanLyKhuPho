import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ResidentProfileDetailDto,
  ResidentProfileListResponseDto,
  UserDto,
} from '@quanlykhupho/shared-types';
import { AuthGuard } from '../security/guards/auth.guard';
import { CsrfGuard } from '../security/guards/csrf.guard';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { ResidentProfilesService } from './resident-profiles.service';
import { CreateResidentProfileDto } from './dto/create-resident-profile.dto';
import { UpdateResidentProfileDto } from './dto/update-resident-profile.dto';
import { ResidentProfileQueryDto } from './dto/resident-profile-query.dto';

@Controller('resident-profiles')
@UseGuards(AuthGuard, CsrfGuard)
export class ResidentProfilesController {
  constructor(
    private readonly residentProfilesService: ResidentProfilesService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: UserDto,
    @Body() dto: CreateResidentProfileDto,
  ): Promise<ResidentProfileDetailDto> {
    return this.residentProfilesService.create(user, dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: UserDto,
    @Query() query: ResidentProfileQueryDto,
  ): Promise<ResidentProfileListResponseDto> {
    return this.residentProfilesService.findAll(user, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
  ): Promise<ResidentProfileDetailDto> {
    return this.residentProfilesService.findOne(user, id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
    @Body() dto: UpdateResidentProfileDto,
  ): Promise<ResidentProfileDetailDto> {
    return this.residentProfilesService.update(user, id, dto);
  }
}
