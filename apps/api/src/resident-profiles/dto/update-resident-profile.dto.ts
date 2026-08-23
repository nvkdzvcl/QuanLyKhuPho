import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender } from '@quanlykhupho/shared-types';

export class UpdateResidentProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Họ và tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @MaxLength(255, { message: 'Họ và tên tối đa 255 ký tự' })
  fullName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/[\s-]/g, '') : value))
  @IsString({ message: 'Số Căn cước công dân phải là chuỗi ký tự' })
  @Matches(/^\d{12}$/, { message: 'Số Căn cước công dân phải bao gồm đúng 12 chữ số' })
  citizenId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày cấp CCCD không đúng định dạng ngày tháng' })
  citizenIdIssueDate?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không đúng định dạng ngày tháng' })
  birthDate?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ (male, female, other)' })
  gender?: Gender;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nơi sinh phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Nơi sinh tối đa 255 ký tự' })
  placeOfBirth?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Quan hệ với chủ hộ phải là chuỗi ký tự' })
  @MaxLength(100, { message: 'Quan hệ với chủ hộ tối đa 100 ký tự' })
  relationshipToHead?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự' })
  phoneNumber?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ' })
  @MaxLength(255, { message: 'Email tối đa 255 ký tự' })
  email?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nghề nghiệp phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Nghề nghiệp tối đa 255 ký tự' })
  occupation?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Địa chỉ thường trú phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Địa chỉ thường trú không được để trống' })
  @MaxLength(500, { message: 'Địa chỉ thường trú tối đa 500 ký tự' })
  permanentAddress?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Địa chỉ hiện tại phải là chuỗi ký tự' })
  @MaxLength(500, { message: 'Địa chỉ hiện tại tối đa 500 ký tự' })
  currentAddress?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Phường/Xã phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Phường/Xã tối đa 255 ký tự' })
  ward?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Tỉnh/Thành phố phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Tỉnh/Thành phố tối đa 255 ký tự' })
  city?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Mã số hộ khẩu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã số hộ khẩu không được để trống' })
  @MaxLength(50, { message: 'Mã số hộ khẩu tối đa 50 ký tự' })
  householdCode?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Mã khu phố không đúng định dạng UUID' })
  neighborhoodId?: string;
}
