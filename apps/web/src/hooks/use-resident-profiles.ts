import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  CreateResidentProfileDto,
  ResidentProfileDetailDto,
  ResidentProfileFilterQueryDto,
  ResidentProfileListResponseDto,
  UpdateResidentProfileDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

export function useResidentProfiles(
  query: ResidentProfileFilterQueryDto = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['resident-profiles', 'list', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.append('search', query.search);
      if (query.neighborhoodId) params.append('neighborhoodId', query.neighborhoodId);
      if (query.gender) params.append('gender', query.gender);
      if (query.page) params.append('page', String(query.page));
      if (query.limit) params.append('limit', String(query.limit));

      const res = await apiClient.get<ApiResponseEnvelope<ResidentProfileListResponseDto>>(
        `/resident-profiles?${params.toString()}`,
      );
      return res.data.data;
    },
    enabled: options.enabled ?? true,
  });
}

export function useResidentProfile(id: string | null) {
  return useQuery({
    queryKey: ['resident-profiles', 'detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<ApiResponseEnvelope<ResidentProfileDetailDto>>(
        `/resident-profiles/${id}`,
      );
      return res.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateResidentProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateResidentProfileDto) => {
      const res = await apiClient.post<ApiResponseEnvelope<ResidentProfileDetailDto>>(
        '/resident-profiles',
        dto,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resident-profiles'] });
    },
  });
}

export function useUpdateResidentProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: UpdateResidentProfileDto;
    }) => {
      const res = await apiClient.patch<ApiResponseEnvelope<ResidentProfileDetailDto>>(
        `/resident-profiles/${id}`,
        dto,
      );
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['resident-profiles'] });
      queryClient.invalidateQueries({
        queryKey: ['resident-profiles', 'detail', variables.id],
      });
    },
  });
}
