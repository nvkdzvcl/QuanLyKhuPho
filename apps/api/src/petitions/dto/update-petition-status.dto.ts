import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PetitionStatus } from '@quanlykhupho/shared-types';

export class UpdatePetitionStatusDto {
  @IsNotEmpty({ message: 'Trạng thái chuyển đổi không được để trống' })
  @IsEnum(PetitionStatus, {
    message:
      'Trạng thái không hợp lệ. Cho phép: processing, resolved, rejected',
  })
  status: PetitionStatus;

  @IsOptional()
  @IsString({ message: 'Ý kiến / lý do phản hồi phải là chuỗi ký tự' })
  @MaxLength(1000, { message: 'Phản hồi tối đa 1000 ký tự' })
  responseNote?: string;
}
