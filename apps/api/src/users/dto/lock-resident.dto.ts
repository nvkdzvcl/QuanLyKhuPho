import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LockResidentDto } from '@quanlykhupho/shared-types';

export class LockResidentRequestDto implements LockResidentDto {
  @IsString({ message: 'Lý do khóa tài khoản phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Lý do khóa tài khoản không được để trống' })
  @MaxLength(1000, { message: 'Lý do không được vượt quá 1000 ký tự' })
  reason!: string;
}
