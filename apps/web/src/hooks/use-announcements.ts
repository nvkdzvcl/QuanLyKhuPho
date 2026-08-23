import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AnnouncementDetailDto,
  AnnouncementDto,
  AnnouncementFeedQueryDto,
  AnnouncementFeedResponseDto,
  ApiResponseEnvelope,
  CommentDto,
  CreateAnnouncementDto,
  CreateCommentDto,
  ModerateCommentDto,
  UpdateAnnouncementDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

export function useAnnouncementFeed(query: AnnouncementFeedQueryDto = {}) {
  return useQuery({
    queryKey: ['announcements', 'feed', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.scope) params.append('scope', query.scope);
      if (query.neighborhoodId) params.append('neighborhoodId', query.neighborhoodId);
      if (query.search) params.append('search', query.search);
      if (query.page) params.append('page', String(query.page));
      if (query.limit) params.append('limit', String(query.limit));

      const res = await apiClient.get<ApiResponseEnvelope<AnnouncementFeedResponseDto>>(
        `/announcements?${params.toString()}`,
      );
      return res.data.data;
    },
  });
}

export function useAnnouncementDetail(id: string | null) {
  return useQuery({
    queryKey: ['announcements', 'detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<ApiResponseEnvelope<AnnouncementDetailDto>>(
        `/announcements/${id}`,
      );
      return res.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dto,
      files,
    }: {
      dto: CreateAnnouncementDto;
      files?: File[];
    }) => {
      const formData = new FormData();
      formData.append('title', dto.title);
      formData.append('content', dto.content);
      formData.append('scope', dto.scope);
      if (dto.neighborhoodId) {
        formData.append('neighborhoodId', dto.neighborhoodId);
      }

      if (files && files.length > 0) {
        for (const file of files) {
          formData.append('files', file);
        }
      }

      const res = await apiClient.post<ApiResponseEnvelope<AnnouncementDto>>(
        '/announcements',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: UpdateAnnouncementDto;
    }) => {
      const res = await apiClient.patch<ApiResponseEnvelope<AnnouncementDto>>(
        `/announcements/${id}`,
        dto,
      );
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({
        queryKey: ['announcements', 'detail', variables.id],
      });
    },
  });
}

export function useRemoveAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<ApiResponseEnvelope<{ success: boolean; message: string }>>(
        `/announcements/${id}`,
      );
      return res.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({
        queryKey: ['announcements', 'detail', id],
      });
    },
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      announcementId,
      dto,
    }: {
      announcementId: string;
      dto: CreateCommentDto;
    }) => {
      const res = await apiClient.post<ApiResponseEnvelope<CommentDto>>(
        `/announcements/${announcementId}/comments`,
        dto,
      );
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['announcements', 'detail', variables.announcementId],
      });
      queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] });
    },
  });
}

export function useModerateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      announcementId,
      commentId,
      dto,
    }: {
      announcementId: string;
      commentId: string;
      dto: ModerateCommentDto;
    }) => {
      const res = await apiClient.patch<ApiResponseEnvelope<CommentDto>>(
        `/announcements/${announcementId}/comments/${commentId}/moderate`,
        dto,
      );
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['announcements', 'detail', variables.announcementId],
      });
    },
  });
}
