import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ExportFormat,
  ExportQueryDto as IExportQueryDto,
  Gender,
  HighestEducation,
  PartyStatus,
  PetitionCategory,
  PetitionStatus,
} from '@quanlykhupho/shared-types';

export class ExportQueryDto implements IExportQueryDto {
  @IsOptional()
  @IsEnum(ExportFormat, {
    message: 'Định dạng xuất dữ liệu không hợp lệ (hỗ trợ csv hoặc xlsx)',
  })
  format?: ExportFormat = ExportFormat.CSV;

  @IsOptional()
  @IsUUID('4', { message: 'Mã khu phố không đúng định dạng UUID' })
  neighborhoodId?: string;

  // Resident / Political-Social filters
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Từ khóa tìm kiếm tối đa 100 ký tự' })
  search?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính không hợp lệ' })
  gender?: Gender;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Độ tuổi bắt đầu phải là số nguyên' })
  @Min(0, { message: 'Độ tuổi bắt đầu tối thiểu là 0' })
  @Max(150, { message: 'Độ tuổi bắt đầu tối đa là 150' })
  ageFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Độ tuổi kết thúc phải là số nguyên' })
  @Min(0, { message: 'Độ tuổi kết thúc tối thiểu là 0' })
  @Max(150, { message: 'Độ tuổi kết thúc tối đa là 150' })
  ageTo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Quan hệ với chủ hộ tối đa 100 ký tự' })
  relationshipToHead?: string;

  @IsOptional()
  @IsIn([...Object.values(PartyStatus), 'not_updated'], {
    message: 'Tình trạng Đảng không hợp lệ',
  })
  partyStatus?: PartyStatus | 'not_updated';

  @IsOptional()
  @IsEnum(HighestEducation, {
    message: 'Trình độ học vấn tối thiểu không hợp lệ',
  })
  minEducation?: HighestEducation;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Nghề nghiệp tối đa 255 ký tự' })
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Phường/Xã tối đa 255 ký tự' })
  ward?: string;

  // Activity filter
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Định dạng tháng phải là YYYY-MM (Ví dụ: 2026-08)',
  })
  month?: string;

  // Petition filters
  @IsOptional()
  @IsEnum(PetitionStatus, { message: 'Trạng thái kiến nghị không hợp lệ' })
  status?: PetitionStatus;

  @IsOptional()
  @IsEnum(PetitionCategory, { message: 'Danh mục kiến nghị không hợp lệ' })
  category?: PetitionCategory;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không đúng định dạng YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không đúng định dạng YYYY-MM-DD' })
  endDate?: string;
}
