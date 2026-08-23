import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  PeriodicReportQueryDto as IPeriodicReportQueryDto,
  ReportingPeriodType,
} from '@quanlykhupho/shared-types';

export class PeriodicReportQueryDto implements IPeriodicReportQueryDto {
  @IsEnum(ReportingPeriodType, {
    message: 'Loại kỳ báo cáo không hợp lệ (phải là month hoặc quarter)',
  })
  periodType!: ReportingPeriodType;

  @Type(() => Number)
  @IsInt({ message: 'Năm báo cáo phải là số nguyên' })
  @Min(2000, { message: 'Năm báo cáo không hợp lệ' })
  @Max(2100, { message: 'Năm báo cáo không hợp lệ' })
  year!: number;

  @Type(() => Number)
  @IsInt({ message: 'Kỳ báo cáo phải là số nguyên' })
  @Min(1, { message: 'Kỳ báo cáo không hợp lệ' })
  @Max(12, { message: 'Kỳ báo cáo không hợp lệ' })
  period!: number;
}
