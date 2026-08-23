import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  PoliticalSocialProfileDto,
  PoliticalSocialProfileListResponseDto,
  ResidentPoliticalSocialItemDto,
  UserDto,
} from '@quanlykhupho/shared-types';
import { AuthGuard } from '../security/guards/auth.guard';
import { CsrfGuard } from '../security/guards/csrf.guard';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { PoliticalSocialProfilesService } from './political-social-profiles.service';
import { PoliticalSocialQueryDto } from './dto/political-social-query.dto';
import { UpsertPoliticalSocialProfileDto } from './dto/upsert-political-social-profile.dto';

@Controller('political-social-profiles')
@UseGuards(AuthGuard, CsrfGuard)
export class PoliticalSocialProfilesController {
  constructor(
    private readonly politicalSocialProfilesService: PoliticalSocialProfilesService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: UserDto,
    @Query() query: PoliticalSocialQueryDto,
  ): Promise<PoliticalSocialProfileListResponseDto> {
    return this.politicalSocialProfilesService.findAll(user, query);
  }

  @Get(':residentProfileId')
  async findOne(
    @Param('residentProfileId', ParseUUIDPipe) residentProfileId: string,
    @CurrentUser() user: UserDto,
  ): Promise<ResidentPoliticalSocialItemDto> {
    return this.politicalSocialProfilesService.findOne(user, residentProfileId);
  }

  @Put(':residentProfileId')
  async upsert(
    @Param('residentProfileId', ParseUUIDPipe) residentProfileId: string,
    @CurrentUser() user: UserDto,
    @Body() dto: UpsertPoliticalSocialProfileDto,
  ): Promise<PoliticalSocialProfileDto> {
    return this.politicalSocialProfilesService.upsert(
      user,
      residentProfileId,
      dto,
    );
  }
}
