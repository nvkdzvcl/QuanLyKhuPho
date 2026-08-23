import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ExportDataset, UserDto } from '@quanlykhupho/shared-types';
import { AuthGuard } from '../security/guards/auth.guard';
import { CurrentUser } from '../security/decorators/current-user.decorator';
import { ExportsService } from './exports.service';
import { ExportQueryDto } from './dto/export-query.dto';

@Controller('exports')
@UseGuards(AuthGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get(':dataset')
  async export(
    @Param('dataset') dataset: ExportDataset,
    @Query() query: ExportQueryDto,
    @CurrentUser() user: UserDto,
    @Res() res: Response,
  ): Promise<void> {
    return this.exportsService.exportData(user, dataset, query, res);
  }
}
