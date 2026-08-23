import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CreateLeaderDto } from '@quanlykhupho/shared-types';

export class CreateLeaderRequestDto implements CreateLeaderDto {
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phoneNumber!: string;

  @IsString({ message: 'Họ và tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @MaxLength(255, { message: 'Họ và tên không được vượt quá 255 ký tự' })
  fullName!: string;

  @IsUUID('4', { message: 'Mã khu phố (neighborhoodId) phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'Khu phố không được để trống' })
  neighborhoodId!: string;

  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự' })
  @IsOptional()
  @MaxLength(500, { message: 'Địa chỉ không được vượt quá 500 ký tự' })
  address?: string;
}
