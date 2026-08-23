import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  CreateResidentProfileDto,
  ResidentExtractionResponseDto,
  ResidentProfileDetailDto,
  ResidentProfileFilterQueryDto,
  ResidentProfileListResponseDto,
  UpdateResidentProfileDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

function buildResidentFilterParams(
  query: ResidentProfileFilterQueryDto = {},
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.neighborhoodId) params.append('neighborhoodId', query.neighborhoodId);
  if (query.gender) params.append('gender', query.gender);
  if (query.ageFrom !== undefined) params.append('ageFrom', String(query.ageFrom));
  if (query.ageTo !== undefined) params.append('ageTo', String(query.ageTo));
  if (query.relationshipToHead) params.append('relationshipToHead', query.relationshipToHead);
  if (query.partyStatus) params.append('partyStatus', query.partyStatus);
  if (query.minEducation) params.append('minEducation', query.minEducation);
  if (query.occupation) params.append('occupation', query.occupation);
  if (query.ward) params.append('ward', query.ward);
  if (query.page) params.append('page', String(query.page));
  if (query.limit) params.append('limit', String(query.limit));
  return params;
}

export function useResidentProfiles(
  query: ResidentProfileFilterQueryDto = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['resident-profiles', 'list', query],
    queryFn: async () => {
      const params = buildResidentFilterParams(query);
      const res = await apiClient.get<ApiResponseEnvelope<ResidentProfileListResponseDto>>(
        `/resident-profiles?${params.toString()}`,
      );
      return res.data.data;
    },
    enabled: options.enabled ?? true,
  });
}

export async function extractResidentsApi(
  query: ResidentProfileFilterQueryDto = {},
): Promise<ResidentExtractionResponseDto> {
  const params = buildResidentFilterParams(query);
  const res = await apiClient.get<ApiResponseEnvelope<ResidentExtractionResponseDto>>(
    `/resident-profiles/extract?${params.toString()}`,
  );
  return res.data.data;
}

export function useExtractResidents(
  query: ResidentProfileFilterQueryDto = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['resident-profiles', 'extract', query],
    queryFn: () => extractResidentsApi(query),
    enabled: options.enabled ?? false,
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
