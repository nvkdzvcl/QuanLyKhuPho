import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UpdateNeighborhoodActivityDto as IUpdateNeighborhoodActivityDto } from '@quanlykhupho/shared-types';

export class UpdateNeighborhoodActivityDto implements IUpdateNeighborhoodActivityDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Tên hoạt động phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên hoạt động không được để trống' })
  @MaxLength(255, { message: 'Tên hoạt động tối đa 255 ký tự' })
  name?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày diễn ra hoạt động không đúng định dạng ngày tháng hợp lệ' })
  activityDate?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Mô tả hoạt động phải là chuỗi ký tự' })
  @MaxLength(4000, { message: 'Mô tả hoạt động tối đa 4000 ký tự' })
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Người phụ trách phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Người phụ trách tối đa 255 ký tự' })
  personInCharge?: string | null;
}
