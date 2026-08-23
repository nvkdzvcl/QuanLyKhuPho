import { Gender, HighestEducation, PartyStatus } from './enums';

export interface PoliticalSocialProfileDto {
  id: string;
  residentProfileId: string;
  partyStatus: PartyStatus;
  partyAdmissionDate: string | null;
  highestEducation: HighestEducation | null;
  specialty: string | null;
  officialOccupation: string | null;
  strengths: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResidentPoliticalSocialItemDto {
  id: string;
  fullName: string;
  birthDate: string;
  gender: Gender;
  permanentAddress: string;
  householdCode: string | null;
  neighborhoodId: string;
  neighborhoodName: string | null;
  politicalSocialProfile: PoliticalSocialProfileDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPoliticalSocialProfileDto {
  partyStatus: PartyStatus;
  partyAdmissionDate?: string | null;
  highestEducation?: HighestEducation | null;
  specialty?: string | null;
  officialOccupation?: string | null;
  strengths?: string | null;
  notes?: string | null;
}

export interface PoliticalSocialProfileFilterQueryDto {
  search?: string;
  neighborhoodId?: string;
  partyStatus?: PartyStatus | 'not_updated';
  page?: number;
  limit?: number;
}

export interface PoliticalSocialProfileListResponseDto {
  items: ResidentPoliticalSocialItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
