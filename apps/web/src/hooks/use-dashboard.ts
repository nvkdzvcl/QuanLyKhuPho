import { useQuery } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  DashboardPetitionCategoriesQueryDto,
  NeighborhoodDetailSummaryDto,
  PetitionCategoryAnalyticsResponseDto,
  WardOverviewDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

/**
 * Hook to fetch ward-level overview statistics (FR-17).
 */
export function useWardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'ward-overview'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponseEnvelope<WardOverviewDto>>(
        '/dashboard/ward-overview',
      );
      return res.data.data;
    },
  });
}

/**
 * Hook to fetch detailed drill-down statistics for a specific neighborhood (FR-18).
 */
export function useNeighborhoodDrillDown(neighborhoodId: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'neighborhood', neighborhoodId],
    queryFn: async () => {
      if (!neighborhoodId) return null;
      const res = await apiClient.get<
        ApiResponseEnvelope<NeighborhoodDetailSummaryDto>
      >(`/dashboard/neighborhoods/${neighborhoodId}`);
      return res.data.data;
    },
    enabled: Boolean(neighborhoodId),
  });
}

/**
 * Hook to fetch petition category series analytics (FR-19).
 */
export function usePetitionCategoryAnalytics(
  query: DashboardPetitionCategoriesQueryDto = {},
) {
  return useQuery({
    queryKey: ['dashboard', 'petition-categories', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.neighborhoodId) {
        params.append('neighborhoodId', query.neighborhoodId);
      }
      if (query.startDate) {
        params.append('startDate', query.startDate);
      }
      if (query.endDate) {
        params.append('endDate', query.endDate);
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/dashboard/petition-categories?${queryString}`
        : '/dashboard/petition-categories';

      const res = await apiClient.get<
        ApiResponseEnvelope<PetitionCategoryAnalyticsResponseDto>
      >(endpoint);
      return res.data.data;
    },
  });
}
