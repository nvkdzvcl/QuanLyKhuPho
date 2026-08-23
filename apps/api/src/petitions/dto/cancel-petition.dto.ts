import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelPetitionDto {
  @IsOptional()
  @IsString({ message: 'Lý do hủy phải là chuỗi ký tự' })
  @MaxLength(500, { message: 'Lý do hủy tối đa 500 ký tự' })
  reason?: string;
}
