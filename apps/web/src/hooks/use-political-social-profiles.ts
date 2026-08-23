import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  PoliticalSocialProfileDto,
  PoliticalSocialProfileFilterQueryDto,
  PoliticalSocialProfileListResponseDto,
  ResidentPoliticalSocialItemDto,
  UpsertPoliticalSocialProfileDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

export function usePoliticalSocialProfiles(
  query: PoliticalSocialProfileFilterQueryDto = {},
) {
  return useQuery({
    queryKey: ['political-social-profiles', 'list', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.append('search', query.search);
      if (query.neighborhoodId)
        params.append('neighborhoodId', query.neighborhoodId);
      if (query.partyStatus) params.append('partyStatus', query.partyStatus);
      if (query.page) params.append('page', String(query.page));
      if (query.limit) params.append('limit', String(query.limit));

      const res = await apiClient.get<
        ApiResponseEnvelope<PoliticalSocialProfileListResponseDto>
      >(`/political-social-profiles?${params.toString()}`);
      return res.data.data;
    },
  });
}

export function usePoliticalSocialProfile(residentProfileId: string | null) {
  return useQuery({
    queryKey: ['political-social-profiles', 'detail', residentProfileId],
    queryFn: async () => {
      if (!residentProfileId) return null;
      const res = await apiClient.get<
        ApiResponseEnvelope<ResidentPoliticalSocialItemDto>
      >(`/political-social-profiles/${residentProfileId}`);
      return res.data.data;
    },
    enabled: Boolean(residentProfileId),
  });
}

export function useUpsertPoliticalSocialProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      residentProfileId,
      dto,
    }: {
      residentProfileId: string;
      dto: UpsertPoliticalSocialProfileDto;
    }) => {
      const res = await apiClient.put<
        ApiResponseEnvelope<PoliticalSocialProfileDto>
      >(`/political-social-profiles/${residentProfileId}`, dto);
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['political-social-profiles'],
      });
      queryClient.invalidateQueries({
        queryKey: [
          'political-social-profiles',
          'detail',
          variables.residentProfileId,
        ],
      });
    },
  });
}
