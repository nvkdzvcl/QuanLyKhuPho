import { AccountStatus, UserRole } from './enums';

export interface NeighborhoodDto {
  id: string;
  code: string;
  name: string;
  ward: string;
  district: string | null;
  city: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDto {
  id: string;
  maskedPhone: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  address?: string | null;
  neighborhoodId?: string | null;
  neighborhood?: NeighborhoodDto | null;
  rejectionReason?: string | null;
  lockReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUserResponseDto {
  user: UserDto;
}

export type ManagedResidentStatus = AccountStatus.ACTIVE | AccountStatus.LOCKED;

export interface ManagedResidentQueryDto {
  status?: ManagedResidentStatus;
  neighborhoodId?: string;
}
