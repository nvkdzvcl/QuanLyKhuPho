import { PetitionCategory, PetitionStatus, UserRole } from './enums';
import { NeighborhoodDto } from './user';

export interface PetitionEvidenceDto {
  id: string;
  petitionId?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface PetitionHistoryUserDto {
  id: string;
  fullName: string;
  role: UserRole;
  maskedPhone?: string;
}

export interface PetitionHistoryDto {
  id: string;
  petitionId: string;
  fromStatus?: PetitionStatus | null;
  toStatus: PetitionStatus;
  changedById: string;
  changedBy?: PetitionHistoryUserDto | null;
  note?: string | null;
  createdAt: string;
}

export interface PetitionAuthorDto {
  id: string;
  fullName: string;
  role: UserRole;
  maskedPhone?: string;
  address?: string | null;
  neighborhood?: NeighborhoodDto | null;
}

export interface PetitionDto {
  id: string;
  title: string;
  description: string;
  category: PetitionCategory;
  status: PetitionStatus;
  neighborhoodId: string;
  neighborhood?: NeighborhoodDto | null;
  authorId: string;
  author: PetitionAuthorDto;
  evidence: PetitionEvidenceDto[];
  latestHistory?: PetitionHistoryDto | null;
  responseNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PetitionDetailDto extends PetitionDto {
  history: PetitionHistoryDto[];
}

export interface CreatePetitionDto {
  title: string;
  description: string;
  category: PetitionCategory;
}

export interface UpdatePetitionStatusDto {
  status: PetitionStatus;
  responseNote?: string;
}

export interface CancelPetitionDto {
  reason?: string;
}

export interface PetitionFilterQueryDto {
  status?: PetitionStatus;
  category?: PetitionCategory;
  startDate?: string;
  endDate?: string;
  search?: string;
  neighborhoodId?: string;
  page?: number;
  limit?: number;
}

export interface PetitionListResponseDto {
  items: PetitionDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
