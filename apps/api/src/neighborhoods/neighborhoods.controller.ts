import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { NeighborhoodDto } from '@quanlykhupho/shared-types';
import { Public } from '../security/decorators/public.decorator';
import { NeighborhoodsService } from './neighborhoods.service';

@Controller('neighborhoods')
export class NeighborhoodsController {
  constructor(private readonly neighborhoodsService: NeighborhoodsService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getNeighborhoods(): Promise<NeighborhoodDto[]> {
    return this.neighborhoodsService.findAll();
  }
}
