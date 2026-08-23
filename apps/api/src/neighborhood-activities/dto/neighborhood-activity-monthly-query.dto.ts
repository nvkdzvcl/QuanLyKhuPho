import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NeighborhoodActivityMonthlyQueryDto as INeighborhoodActivityMonthlyQueryDto } from '@quanlykhupho/shared-types';

export class NeighborhoodActivityMonthlyQueryDto implements INeighborhoodActivityMonthlyQueryDto {
  @IsNotEmpty({ message: 'Tháng tra cứu không được để trống' })
  @IsString({ message: 'Tháng tra cứu phải là chuỗi ký tự' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Tháng tra cứu phải có định dạng YYYY-MM (Ví dụ: 2026-08)',
  })
  month: string;

  @IsOptional()
  @IsUUID('4', { message: 'Mã khu phố không đúng định dạng UUID' })
  neighborhoodId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang tối thiểu là 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bản ghi mỗi trang phải là số nguyên' })
  @Min(1, { message: 'Số bản ghi mỗi trang tối thiểu là 1' })
  @Max(50, { message: 'Số bản ghi mỗi trang tối đa là 50' })
  limit?: number;
}
