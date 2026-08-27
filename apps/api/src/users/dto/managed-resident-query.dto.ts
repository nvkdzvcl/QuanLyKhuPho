import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  AccountStatus,
  ManagedResidentQueryDto as IManagedResidentQueryDto,
  ManagedResidentStatus,
} from '@quanlykhupho/shared-types';

export class ManagedResidentQueryDto implements IManagedResidentQueryDto {
  @IsOptional()
  @IsIn([AccountStatus.ACTIVE, AccountStatus.LOCKED], {
    message: 'Trạng thái lọc chỉ chấp nhận active hoặc locked',
  })
  status?: ManagedResidentStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Mã khu phố không đúng định dạng UUID' })
  neighborhoodId?: string;
}
