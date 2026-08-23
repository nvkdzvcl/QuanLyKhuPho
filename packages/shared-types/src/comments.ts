import { UserRole } from './enums';

export interface CommentAuthorDto {
  id: string;
  fullName: string;
  role: UserRole;
  neighborhoodId?: string | null;
}

export interface CommentDto {
  id: string;
  announcementId: string;
  authorId: string;
  author: CommentAuthorDto;
  content: string;
  isRemoved: boolean;
  removedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentDto {
  content: string;
}

export interface ModerateCommentDto {
  isRemoved: boolean;
  removedReason?: string;
}
