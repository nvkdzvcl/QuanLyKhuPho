import { UserDto } from './user';

export interface RejectResidentDto {
  reason: string;
}

export interface LockResidentDto {
  reason: string;
}

export interface CreateLeaderDto {
  phoneNumber: string;
  fullName: string;
  neighborhoodId: string;
  address?: string;
}

export interface PendingResidentsResponseDto {
  residents: UserDto[];
  total: number;
}
