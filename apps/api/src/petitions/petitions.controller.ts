import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import {
  PetitionDetailDto,
  PetitionDto,
  PetitionListResponseDto,
  UserDto,
} from '@quanlykhupho/shared-types';
import { AuthGuard } from '../security/guards/auth.guard';
import { CsrfGuard } from '../security/guards/csrf.guard';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { PetitionsService } from './petitions.service';
import { CreatePetitionDto } from './dto/create-petition.dto';
import { UpdatePetitionStatusDto } from './dto/update-petition-status.dto';
import { CancelPetitionDto } from './dto/cancel-petition.dto';
import { PetitionQueryDto } from './dto/petition-query.dto';

@Controller('petitions')
@UseGuards(AuthGuard, CsrfGuard)
export class PetitionsController {
  constructor(private readonly petitionsService: PetitionsService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async create(
    @CurrentUser() user: UserDto,
    @Body() dto: CreatePetitionDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<PetitionDto> {
    return this.petitionsService.create(user, dto, files);
  }

  @Get()
  async findAll(
    @CurrentUser() user: UserDto,
    @Query() query: PetitionQueryDto,
  ): Promise<PetitionListResponseDto> {
    return this.petitionsService.findAll(user, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
  ): Promise<PetitionDetailDto> {
    return this.petitionsService.findOne(user, id);
  }

  @Get(':id/evidence/:evidenceId')
  async downloadEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: UserDto,
    @Res() res: Response,
  ): Promise<void> {
    const evidence = await this.petitionsService.getEvidenceStream(
      user,
      id,
      evidenceId,
    );

    const encodedFilename = encodeURIComponent(evidence.originalName);
    res.setHeader('Content-Type', evidence.mimeType);
    res.setHeader('Content-Length', evidence.fileSize);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${evidence.originalName.replace(/"/g, '')}"; filename*=UTF-8''${encodedFilename}`,
    );

    const stream = fs.createReadStream(evidence.filePath);
    stream.pipe(res);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
    @Body() dto: UpdatePetitionStatusDto,
  ): Promise<PetitionDetailDto> {
    return this.petitionsService.updateStatus(user, id, dto);
  }

  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserDto,
    @Body() dto: CancelPetitionDto,
  ): Promise<PetitionDetailDto> {
    return this.petitionsService.cancel(user, id, dto);
  }
}
