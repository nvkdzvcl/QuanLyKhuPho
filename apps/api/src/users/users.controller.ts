import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserDto, UserRole } from '@quanlykhupho/shared-types';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { Roles } from '../security/decorators/roles.decorator';
import { AuthGuard } from '../security/guards/auth.guard';
import { CsrfGuard } from '../security/guards/csrf.guard';
import { RolesGuard } from '../security/guards/roles.guard';
import { CreateLeaderRequestDto } from './dto/create-leader.dto';
import { LockResidentRequestDto } from './dto/lock-resident.dto';
import { ManagedResidentQueryDto } from './dto/managed-resident-query.dto';
import { RejectResidentRequestDto } from './dto/reject-resident.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard, CsrfGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('pending')
  @Roles(UserRole.LEADER, UserRole.OFFICER)
  @HttpCode(HttpStatus.OK)
  async getPendingResidents(
    @CurrentUser() currentUser: UserDto,
    @Query('neighborhoodId') neighborhoodId?: string,
  ): Promise<UserDto[]> {
    return this.usersService.getPendingResidents(currentUser, neighborhoodId);
  }

  @Get('residents')
  @Roles(UserRole.LEADER, UserRole.OFFICER)
  @HttpCode(HttpStatus.OK)
  async getManagedResidents(
    @CurrentUser() currentUser: UserDto,
    @Query() query: ManagedResidentQueryDto,
  ): Promise<UserDto[]> {
    return this.usersService.getManagedResidents(currentUser, query);
  }

  @Patch(':id/approve')
  @Roles(UserRole.LEADER, UserRole.OFFICER)
  @HttpCode(HttpStatus.OK)
  async approveResident(
    @Param('id') residentId: string,
    @CurrentUser() currentUser: UserDto,
  ): Promise<UserDto> {
    return this.usersService.approveResident(residentId, currentUser);
  }

  @Patch(':id/reject')
  @Roles(UserRole.LEADER, UserRole.OFFICER)
  @HttpCode(HttpStatus.OK)
  async rejectResident(
    @Param('id') residentId: string,
    @Body() dto: RejectResidentRequestDto,
    @CurrentUser() currentUser: UserDto,
  ): Promise<UserDto> {
    return this.usersService.rejectResident(residentId, dto, currentUser);
  }

  @Patch(':id/lock')
  @Roles(UserRole.LEADER, UserRole.OFFICER)
  @HttpCode(HttpStatus.OK)
  async lockResident(
    @Param('id') residentId: string,
    @Body() dto: LockResidentRequestDto,
    @CurrentUser() currentUser: UserDto,
  ): Promise<UserDto> {
    return this.usersService.lockResident(residentId, dto, currentUser);
  }

  @Patch(':id/unlock')
  @Roles(UserRole.LEADER, UserRole.OFFICER)
  @HttpCode(HttpStatus.OK)
  async unlockResident(
    @Param('id') residentId: string,
    @CurrentUser() currentUser: UserDto,
  ): Promise<UserDto> {
    return this.usersService.unlockResident(residentId, currentUser);
  }

  @Post('leaders')
  @Roles(UserRole.OFFICER)
  @HttpCode(HttpStatus.CREATED)
  async createLeader(
    @Body() dto: CreateLeaderRequestDto,
    @CurrentUser() currentUser: UserDto,
  ): Promise<UserDto> {
    return this.usersService.createLeader(dto, currentUser);
  }
}
