import { IsNotEmpty, IsString } from 'class-validator';
import { SendOtpRequestDto } from '@quanlykhupho/shared-types';

export class SendOtpDto implements SendOtpRequestDto {
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phoneNumber!: string;
}
