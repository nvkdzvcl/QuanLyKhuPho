import {
  ExportFormat,
  Gender,
  HighestEducation,
  PartyStatus,
  PetitionCategory,
  PetitionStatus,
} from './enums';

export interface ExportQueryDto {
  format?: ExportFormat;
  neighborhoodId?: string;
  // Resident profile & political-social filters
  search?: string;
  gender?: Gender;
  ageFrom?: number;
  ageTo?: number;
  relationshipToHead?: string;
  partyStatus?: PartyStatus | 'not_updated';
  minEducation?: HighestEducation;
  occupation?: string;
  ward?: string;
  // Activity filters
  month?: string;
  // Petition filters
  status?: PetitionStatus;
  category?: PetitionCategory;
  startDate?: string;
  endDate?: string;
}
