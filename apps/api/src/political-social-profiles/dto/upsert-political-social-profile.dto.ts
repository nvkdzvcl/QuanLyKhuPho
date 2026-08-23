import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { HighestEducation, PartyStatus } from '@quanlykhupho/shared-types';

export class UpsertPoliticalSocialProfileDto {
  @IsNotEmpty({ message: 'Tình trạng Đảng không được để trống' })
  @IsEnum(PartyStatus, {
    message: 'Tình trạng Đảng không hợp lệ (party_member, under_consideration, not_member)',
  })
  partyStatus: PartyStatus;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày vào Đảng không đúng định dạng ngày tháng' })
  partyAdmissionDate?: string | null;

  @IsOptional()
  @IsEnum(HighestEducation, {
    message: 'Trình độ học vấn không hợp lệ',
  })
  highestEducation?: HighestEducation | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Chuyên môn / Chuyên ngành phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Chuyên môn / Chuyên ngành tối đa 255 ký tự' })
  specialty?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nghề nghiệp / Vị trí công tác phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Nghề nghiệp / Vị trí công tác tối đa 255 ký tự' })
  officialOccupation?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Sở trường / Kỹ năng nổi bật phải là chuỗi ký tự' })
  @MaxLength(1000, { message: 'Sở trường / Kỹ năng nổi bật tối đa 1000 ký tự' })
  strengths?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự' })
  @MaxLength(4000, { message: 'Ghi chú tối đa 4000 ký tự' })
  notes?: string | null;
}
