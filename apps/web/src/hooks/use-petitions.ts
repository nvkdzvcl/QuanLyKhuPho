import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  CancelPetitionDto,
  CreatePetitionDto,
  PetitionDetailDto,
  PetitionDto,
  PetitionFilterQueryDto,
  PetitionListResponseDto,
  UpdatePetitionStatusDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

export function usePetitions(query: PetitionFilterQueryDto = {}) {
  return useQuery({
    queryKey: ['petitions', 'list', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.status) params.append('status', query.status);
      if (query.category) params.append('category', query.category);
      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
      if (query.search) params.append('search', query.search);
      if (query.neighborhoodId) params.append('neighborhoodId', query.neighborhoodId);
      if (query.page) params.append('page', String(query.page));
      if (query.limit) params.append('limit', String(query.limit));

      const res = await apiClient.get<ApiResponseEnvelope<PetitionListResponseDto>>(
        `/petitions?${params.toString()}`,
      );
      return res.data.data;
    },
  });
}

export function usePetitionDetail(id: string | null) {
  return useQuery({
    queryKey: ['petitions', 'detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<ApiResponseEnvelope<PetitionDetailDto>>(
        `/petitions/${id}`,
      );
      return res.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreatePetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dto,
      files,
    }: {
      dto: CreatePetitionDto;
      files?: File[];
    }) => {
      const formData = new FormData();
      formData.append('title', dto.title);
      formData.append('description', dto.description);
      formData.append('category', dto.category);

      if (files && files.length > 0) {
        for (const file of files) {
          formData.append('files', file);
        }
      }

      const res = await apiClient.post<ApiResponseEnvelope<PetitionDto>>(
        '/petitions',
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
      queryClient.invalidateQueries({ queryKey: ['petitions'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUpdatePetitionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: UpdatePetitionStatusDto;
    }) => {
      const res = await apiClient.patch<ApiResponseEnvelope<PetitionDetailDto>>(
        `/petitions/${id}/status`,
        dto,
      );
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['petitions'] });
      queryClient.invalidateQueries({
        queryKey: ['petitions', 'detail', variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCancelPetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto?: CancelPetitionDto;
    }) => {
      const res = await apiClient.patch<ApiResponseEnvelope<PetitionDetailDto>>(
        `/petitions/${id}/cancel`,
        dto || {},
      );
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['petitions'] });
      queryClient.invalidateQueries({
        queryKey: ['petitions', 'detail', variables.id],
      });
    },
  });
}
