import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ActivityFilterCondition,
  CreateNeighborhoodActivityDto as ICreateNeighborhoodActivityDto,
} from '@quanlykhupho/shared-types';

export class CreateNeighborhoodActivityDto implements ICreateNeighborhoodActivityDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Tên hoạt động phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên hoạt động không được để trống' })
  @MaxLength(255, { message: 'Tên hoạt động tối đa 255 ký tự' })
  name: string;

  @IsNotEmpty({ message: 'Ngày diễn ra hoạt động không được để trống' })
  @IsDateString({}, { message: 'Ngày diễn ra hoạt động không đúng định dạng ngày tháng hợp lệ' })
  activityDate: string;

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

  @IsNotEmpty({ message: 'Điều kiện lọc danh sách không được để trống' })
  @IsEnum(ActivityFilterCondition, {
    message: 'Điều kiện lọc danh sách không hợp lệ (all, under_18, over_18, party_member, custom)',
  })
  filterCondition: ActivityFilterCondition;

  @ValidateIf(
    (dto: CreateNeighborhoodActivityDto) =>
      dto.filterCondition === ActivityFilterCondition.CUSTOM,
  )
  @IsOptional()
  @IsArray({ message: 'Danh sách mã nhân khẩu tùy chọn phải là một mảng' })
  @IsUUID('4', { each: true, message: 'Mã nhân khẩu trong danh sách tùy chọn phải là UUID hợp lệ' })
  customResidentIds?: string[];

  @IsOptional()
  @IsUUID('4', { message: 'Mã khu phố không đúng định dạng UUID' })
  neighborhoodId?: string;
}
