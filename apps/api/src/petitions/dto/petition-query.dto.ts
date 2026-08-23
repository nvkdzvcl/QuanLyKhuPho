import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PetitionCategory, PetitionStatus } from '@quanlykhupho/shared-types';

export class PetitionQueryDto {
  @IsOptional()
  @IsEnum(PetitionStatus, { message: 'Trạng thái lọc không hợp lệ' })
  status?: PetitionStatus;

  @IsOptional()
  @IsEnum(PetitionCategory, { message: 'Danh mục lọc không hợp lệ' })
  category?: PetitionCategory;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không đúng định dạng ISO date' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không đúng định dạng ISO date' })
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Từ khóa tìm kiếm tối đa 100 ký tự' })
  search?: string;

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
  @IsInt({ message: 'Số bản ghi trên trang phải là số nguyên' })
  @Min(1, { message: 'Số bản ghi trên trang tối thiểu là 1' })
  @Max(100, { message: 'Số bản ghi trên trang tối đa là 100' })
  limit?: number;
}
