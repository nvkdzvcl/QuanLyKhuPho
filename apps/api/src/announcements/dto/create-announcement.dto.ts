import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AnnouncementScope, CreateAnnouncementDto as ICreateAnnouncementDto } from '@quanlykhupho/shared-types';

export class CreateAnnouncementDto implements ICreateAnnouncementDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề thông báo không được để trống' })
  @MaxLength(255, { message: 'Tiêu đề không được vượt quá 255 ký tự' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung thông báo không được để trống' })
  content: string;

  @IsEnum(AnnouncementScope, { message: 'Phạm vi thông báo không hợp lệ (ward hoặc neighborhood)' })
  scope: AnnouncementScope;

  @IsOptional()
  @IsUUID('4', { message: 'Mã khu phố không hợp lệ' })
  neighborhoodId?: string | null;
}
