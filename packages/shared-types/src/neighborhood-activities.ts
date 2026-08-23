import {
  ActivityFilterCondition,
  ActivityRating,
  AttendanceStatus,
} from './enums';

export interface ActivityParticipantDto {
  id: string;
  activityId: string;
  residentProfileId: string;
  fullName: string;
  attendance: AttendanceStatus;
  notes?: string | null;
  rating?: ActivityRating | null;
  createdAt: string;
  updatedAt: string;
}

export interface NeighborhoodActivityDto {
  id: string;
  neighborhoodId: string;
  neighborhoodName?: string | null;
  createdById: string;
  createdByName?: string | null;
  name: string;
  activityDate: string;
  description?: string | null;
  personInCharge?: string | null;
  filterCondition: ActivityFilterCondition;
  totalParticipants: number;
  attendedCount: number;
  absentCount: number;
  unconfirmedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NeighborhoodActivityDetailDto extends NeighborhoodActivityDto {
  participants: ActivityParticipantDto[];
}

export interface CreateNeighborhoodActivityDto {
  name: string;
  activityDate: string;
  description?: string | null;
  personInCharge?: string | null;
  filterCondition: ActivityFilterCondition;
  customResidentIds?: string[];
  neighborhoodId?: string;
}

export interface CreateNeighborhoodActivityResponseDto {
  activity: NeighborhoodActivityDetailDto;
  warning?: string | null;
  participantCount: number;
}

export interface UpdateNeighborhoodActivityDto {
  name?: string;
  activityDate?: string;
  description?: string | null;
  personInCharge?: string | null;
}

export interface UpdateParticipantItemDto {
  participantId: string;
  attendance: AttendanceStatus;
  notes?: string | null;
  rating?: ActivityRating | null;
}

export interface BatchUpdateParticipantsDto {
  participants: UpdateParticipantItemDto[];
}

export interface NeighborhoodActivityMonthlyQueryDto {
  month: string;
  neighborhoodId?: string;
  page?: number;
  limit?: number;
}

export interface NeighborhoodActivityListResponseDto {
  items: NeighborhoodActivityDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  month: string;
}
