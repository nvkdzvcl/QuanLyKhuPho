import { Gender, HighestEducation, PartyStatus } from './enums';
import { NeighborhoodDto } from './user';

export interface HouseholdDto {
  id: string;
  code: string;
  neighborhoodId: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResidentProfileDto {
  id: string;
  fullName: string;
  maskedCitizenId: string;
  citizenIdIssueDate?: string | null;
  birthDate: string;
  gender: Gender;
  placeOfBirth?: string | null;
  relationshipToHead?: string | null;
  maskedPhone?: string | null;
  maskedEmail?: string | null;
  occupation?: string | null;
  permanentAddress: string;
  currentAddress?: string | null;
  ward?: string | null;
  city?: string | null;
  householdId: string;
  household?: HouseholdDto | null;
  neighborhoodId: string;
  neighborhood?: NeighborhoodDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResidentProfileDetailDto extends ResidentProfileDto {
  citizenId: string;
  phoneNumber?: string | null;
  email?: string | null;
}

export interface CreateResidentProfileDto {
  fullName: string;
  citizenId: string;
  citizenIdIssueDate?: string | null;
  birthDate: string;
  gender?: Gender;
  placeOfBirth?: string | null;
  relationshipToHead?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  occupation?: string | null;
  permanentAddress: string;
  currentAddress?: string | null;
  ward?: string | null;
  city?: string | null;
  householdCode: string;
  neighborhoodId?: string;
}

export interface UpdateResidentProfileDto {
  fullName?: string;
  citizenId?: string;
  citizenIdIssueDate?: string | null;
  birthDate?: string;
  gender?: Gender;
  placeOfBirth?: string | null;
  relationshipToHead?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  occupation?: string | null;
  permanentAddress?: string;
  currentAddress?: string | null;
  ward?: string | null;
  city?: string | null;
  householdCode?: string;
  neighborhoodId?: string;
}

export interface ResidentProfileFilterQueryDto {
  search?: string;
  neighborhoodId?: string;
  gender?: Gender;
  ageFrom?: number;
  ageTo?: number;
  relationshipToHead?: string;
  partyStatus?: PartyStatus | 'not_updated';
  minEducation?: HighestEducation;
  occupation?: string;
  ward?: string;
  page?: number;
  limit?: number;
}

export interface ResidentProfileListResponseDto {
  items: ResidentProfileDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExtractedResidentItemDto {
  id: string;
  fullName: string;
}

export interface ResidentExtractionResponseDto {
  items: ExtractedResidentItemDto[];
  total: number;
}
