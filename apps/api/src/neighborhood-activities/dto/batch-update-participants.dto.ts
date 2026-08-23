import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  ActivityRating,
  AttendanceStatus,
  BatchUpdateParticipantsDto as IBatchUpdateParticipantsDto,
  UpdateParticipantItemDto as IUpdateParticipantItemDto,
} from '@quanlykhupho/shared-types';

export class UpdateParticipantItemDto implements IUpdateParticipantItemDto {
  @IsNotEmpty({ message: 'Mã người tham gia không được để trống' })
  @IsUUID('4', { message: 'Mã người tham gia không đúng định dạng UUID' })
  participantId: string;

  @IsNotEmpty({ message: 'Trạng thái điểm danh không được để trống' })
  @IsEnum(AttendanceStatus, {
    message: 'Trạng thái điểm danh không hợp lệ (attended, absent, unconfirmed)',
  })
  attendance: AttendanceStatus;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự' })
  @MaxLength(1000, { message: 'Ghi chú tối đa 1000 ký tự' })
  notes?: string | null;

  @IsOptional()
  @IsEnum(ActivityRating, {
    message: 'Đánh giá không hợp lệ (good, fair, average)',
  })
  rating?: ActivityRating | null;
}

export class BatchUpdateParticipantsDto implements IBatchUpdateParticipantsDto {
  @IsArray({ message: 'Danh sách cập nhật điểm danh phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => UpdateParticipantItemDto)
  participants: UpdateParticipantItemDto[];
}
