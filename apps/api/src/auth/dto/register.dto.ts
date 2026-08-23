import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { RegisterRequestDto } from '@quanlykhupho/shared-types';

export class RegisterDto implements RegisterRequestDto {
  @IsString({ message: 'Register token phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Register token không được để trống' })
  registerToken!: string;

  @IsString({ message: 'Họ và tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @MaxLength(255, { message: 'Họ và tên không được vượt quá 255 ký tự' })
  fullName!: string;

  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Địa chỉ nơi ở không được để trống' })
  @MaxLength(500, { message: 'Địa chỉ không được vượt quá 500 ký tự' })
  address!: string;

  @IsUUID('4', { message: 'Mã khu phố (neighborhoodId) phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'Khu phố không được để trống' })
  neighborhoodId!: string;
}
