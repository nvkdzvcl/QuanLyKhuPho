import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { RejectResidentDto } from '@quanlykhupho/shared-types';

export class RejectResidentRequestDto implements RejectResidentDto {
  @IsString({ message: 'Lý do từ chối phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  @MaxLength(1000, { message: 'Lý do không được vượt quá 1000 ký tự' })
  reason!: string;
}
