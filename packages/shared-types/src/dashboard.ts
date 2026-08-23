import { PetitionCategory, PetitionStatus, ReportingPeriodType } from './enums';
import { NeighborhoodDto } from './user';

export interface AccountStatusSummaryDto {
  active: number;
  pending: number;
  locked: number;
  rejected: number;
  total: number;
}

export interface PetitionStatusSummaryDto {
  reviewing: number;
  processing: number;
  resolved: number;
  rejected: number;
  cancelled: number;
  total: number;
}

export interface NeighborhoodQuickMetricsDto {
  id: string;
  code: string;
  name: string;
  ward: string;
  residentCount: number;
  activeResidentCount: number;
  pendingResidentCount: number;
  publishedAnnouncementsCount: number;
  totalPetitionsCount: number;
  resolvedPetitionsCount: number;
  pendingPetitionsCount: number;
}

export interface WardOverviewDto {
  neighborhoodCount: number;
  residentCount: number;
  accountsByStatus: AccountStatusSummaryDto;
  petitionsByStatus: PetitionStatusSummaryDto;
  currentMonthAnnouncementsCount: number;
  neighborhoodSummaries: NeighborhoodQuickMetricsDto[];
}

export interface RecentAnnouncementItemDto {
  id: string;
  title: string;
  scope: string;
  status: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

export interface RecentPetitionItemDto {
  id: string;
  title: string;
  category: PetitionCategory;
  status: PetitionStatus;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

export interface NeighborhoodDetailSummaryDto {
  neighborhood: NeighborhoodDto;
  residentCount: number;
  accountsByStatus: AccountStatusSummaryDto;
  publishedAnnouncementsCount: number;
  currentMonthAnnouncementsCount: number;
  petitionsByStatus: PetitionStatusSummaryDto;
  petitionsByCategory: Record<PetitionCategory, number>;
  recentAnnouncements: RecentAnnouncementItemDto[];
  recentPetitions: RecentPetitionItemDto[];
}

export interface PetitionCategorySeriesItemDto {
  category: PetitionCategory;
  count: number;
  percentage: number;
  resolvedCount: number;
}

export interface PetitionCategoryAnalyticsResponseDto {
  total: number;
  series: PetitionCategorySeriesItemDto[];
  neighborhoodId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DashboardPetitionCategoriesQueryDto {
  neighborhoodId?: string;
  startDate?: string;
  endDate?: string;
}

export interface PeriodicReportMetadataDto {
  periodType: ReportingPeriodType;
  year: number;
  period: number;
  label: string;
  startDate: string;
  endDateExclusive: string;
  generatedAt: string;
}

export interface PeriodicReportWardSummaryDto {
  neighborhoodCount: number;
  activeResidentCount: number;
  newResidentRegistrationsCount: number;
  publishedAnnouncementsCount: number;
  petitionsByStatus: PetitionStatusSummaryDto;
}

export interface PeriodicReportNeighborhoodRowDto {
  id: string;
  code: string;
  name: string;
  ward: string;
  activeResidentCount: number;
  newResidentRegistrationsCount: number;
  publishedAnnouncementsCount: number;
  petitionsByStatus: PetitionStatusSummaryDto;
}

export interface PeriodicReportResponseDto
  extends PeriodicReportMetadataDto {
  isDataSufficient: boolean;
  warnings: string[];
  summary: PeriodicReportWardSummaryDto;
  neighborhoods: PeriodicReportNeighborhoodRowDto[];
}

export interface PeriodicReportQueryDto {
  periodType: ReportingPeriodType;
  year: number;
  period: number;
}
