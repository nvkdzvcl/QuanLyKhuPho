import { Equals, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ModerateCommentDto as IModerateCommentDto } from '@quanlykhupho/shared-types';

export class ModerateCommentDto implements IModerateCommentDto {
  @IsBoolean()
  @Equals(true, { message: 'Bình luận đã ẩn không thể được mở lại' })
  isRemoved: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Lý do kiểm duyệt không được vượt quá 1000 ký tự' })
  removedReason?: string;
}
