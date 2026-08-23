import { IsNotEmpty, IsString, Length } from 'class-validator';
import { VerifyOtpRequestDto } from '@quanlykhupho/shared-types';

export class VerifyOtpDto implements VerifyOtpRequestDto {
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phoneNumber!: string;

  @IsString({ message: 'Mã OTP phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @Length(6, 6, { message: 'Mã OTP phải gồm đúng 6 chữ số' })
  otpCode!: string;
}
