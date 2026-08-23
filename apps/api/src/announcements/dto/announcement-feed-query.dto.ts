import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AnnouncementScope, AnnouncementFeedQueryDto as IAnnouncementFeedQueryDto } from '@quanlykhupho/shared-types';

export class AnnouncementFeedQueryDto implements IAnnouncementFeedQueryDto {
  @IsOptional()
  @IsEnum(AnnouncementScope)
  scope?: AnnouncementScope;

  @IsOptional()
  @IsUUID('4')
  neighborhoodId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
