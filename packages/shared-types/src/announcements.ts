import { AnnouncementScope, AnnouncementStatus, UserRole } from './enums';
import { NeighborhoodDto } from './user';

export interface AttachmentDto {
  id: string;
  announcementId?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface AnnouncementAuthorDto {
  id: string;
  fullName: string;
  role: UserRole;
  maskedPhone?: string;
}

export interface AnnouncementDto {
  id: string;
  title: string;
  content: string;
  scope: AnnouncementScope;
  status: AnnouncementStatus;
  neighborhoodId?: string | null;
  neighborhood?: NeighborhoodDto | null;
  authorId: string;
  author: AnnouncementAuthorDto;
  attachments: AttachmentDto[];
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementDetailDto extends AnnouncementDto {
  comments: import('./comments').CommentDto[];
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  scope: AnnouncementScope;
  neighborhoodId?: string | null;
}

export interface UpdateAnnouncementDto {
  title?: string;
  content?: string;
}

export interface AnnouncementFeedQueryDto {
  scope?: AnnouncementScope;
  neighborhoodId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AnnouncementFeedResponseDto {
  items: AnnouncementDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
