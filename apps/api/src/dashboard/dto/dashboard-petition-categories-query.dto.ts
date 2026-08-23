import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class DashboardPetitionCategoriesQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'Mã khu phố không đúng định dạng UUID' })
  neighborhoodId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không đúng định dạng ISO date' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không đúng định dạng ISO date' })
  endDate?: string;
}
