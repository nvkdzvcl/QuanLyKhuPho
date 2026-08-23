import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { UpdateAnnouncementDto as IUpdateAnnouncementDto } from '@quanlykhupho/shared-types';

export class UpdateAnnouncementDto implements IUpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề thông báo không được để trống' })
  @MaxLength(255, { message: 'Tiêu đề không được vượt quá 255 ký tự' })
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Nội dung thông báo không được để trống' })
  content?: string;
}
