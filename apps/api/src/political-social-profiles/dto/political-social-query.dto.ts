import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartyStatus } from '@quanlykhupho/shared-types';

export class PoliticalSocialQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Từ khóa tìm kiếm tối đa 100 ký tự' })
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Mã khu phố không đúng định dạng UUID' })
  neighborhoodId?: string;

  @IsOptional()
  @IsIn([...Object.values(PartyStatus), 'not_updated'], {
    message: 'Bộ lọc tình trạng Đảng không hợp lệ',
  })
  partyStatus?: PartyStatus | 'not_updated';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang tối thiểu là 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bản ghi trên trang phải là số nguyên' })
  @Min(1, { message: 'Số bản ghi trên trang tối thiểu là 1' })
  @Max(50, { message: 'Số bản ghi trên trang tối đa là 50' })
  limit?: number = 10;
}
