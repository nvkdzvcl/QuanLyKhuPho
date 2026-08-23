import { useQuery } from '@tanstack/react-query';
import { ApiResponseEnvelope, NeighborhoodDto } from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

export function useNeighborhoods() {
  return useQuery({
    queryKey: ['neighborhoods'],
    queryFn: async (): Promise<NeighborhoodDto[]> => {
      const res = await apiClient.get<ApiResponseEnvelope<NeighborhoodDto[]>>(
        '/neighborhoods',
      );
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
