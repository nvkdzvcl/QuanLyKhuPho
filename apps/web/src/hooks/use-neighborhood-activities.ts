import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  BatchUpdateParticipantsDto,
  CreateNeighborhoodActivityDto,
  CreateNeighborhoodActivityResponseDto,
  NeighborhoodActivityDetailDto,
  NeighborhoodActivityListResponseDto,
  NeighborhoodActivityMonthlyQueryDto,
  UpdateNeighborhoodActivityDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

export function useMonthlyNeighborhoodActivities(
  query: NeighborhoodActivityMonthlyQueryDto,
) {
  return useQuery({
    queryKey: ['neighborhood-activities', 'monthly', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.month) params.append('month', query.month);
      if (query.neighborhoodId)
        params.append('neighborhoodId', query.neighborhoodId);
      if (query.page) params.append('page', String(query.page));
      if (query.limit) params.append('limit', String(query.limit));

      const res = await apiClient.get<
        ApiResponseEnvelope<NeighborhoodActivityListResponseDto>
      >(`/neighborhood-activities/monthly?${params.toString()}`);
      return res.data.data;
    },
    enabled: Boolean(query.month),
  });
}

export function useNeighborhoodActivity(id: string | null) {
  return useQuery({
    queryKey: ['neighborhood-activities', 'detail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<
        ApiResponseEnvelope<NeighborhoodActivityDetailDto>
      >(`/neighborhood-activities/${id}`);
      return res.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateNeighborhoodActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateNeighborhoodActivityDto) => {
      const res = await apiClient.post<
        ApiResponseEnvelope<CreateNeighborhoodActivityResponseDto>
      >('/neighborhood-activities', dto);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighborhood-activities'] });
    },
  });
}

export function useUpdateNeighborhoodActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: UpdateNeighborhoodActivityDto;
    }) => {
      const res = await apiClient.patch<
        ApiResponseEnvelope<NeighborhoodActivityDetailDto>
      >(`/neighborhood-activities/${id}`, dto);
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['neighborhood-activities'] });
      queryClient.invalidateQueries({
        queryKey: ['neighborhood-activities', 'detail', variables.id],
      });
    },
  });
}

export function useBatchUpdateParticipants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      dto,
    }: {
      activityId: string;
      dto: BatchUpdateParticipantsDto;
    }) => {
      const res = await apiClient.put<
        ApiResponseEnvelope<NeighborhoodActivityDetailDto>
      >(`/neighborhood-activities/${activityId}/participants`, dto);
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['neighborhood-activities'] });
      queryClient.invalidateQueries({
        queryKey: ['neighborhood-activities', 'detail', variables.activityId],
      });
    },
  });
}
