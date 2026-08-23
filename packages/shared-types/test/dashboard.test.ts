import { describe, it, expect } from 'vitest';
import {
  PetitionCategory,
  PetitionStatus,
  WardOverviewDto,
  NeighborhoodDetailSummaryDto,
  PetitionCategoryAnalyticsResponseDto,
} from '../src';

describe('Shared Dashboard Types & Contracts', () => {
  it('should define valid WardOverviewDto structure', () => {
    const overview: WardOverviewDto = {
      neighborhoodCount: 2,
      residentCount: 150,
      accountsByStatus: {
        active: 120,
        pending: 20,
        locked: 5,
        rejected: 5,
        total: 150,
      },
      petitionsByStatus: {
        reviewing: 10,
        processing: 5,
        resolved: 30,
        rejected: 2,
        cancelled: 1,
        total: 48,
      },
      currentMonthAnnouncementsCount: 8,
      neighborhoodSummaries: [
        {
          id: '99999999-9999-4999-9999-999999999991',
          code: 'KP-01',
          name: 'Khu phố 1',
          ward: 'Phường Bến Nghé',
          residentCount: 80,
          activeResidentCount: 65,
          pendingResidentCount: 10,
          publishedAnnouncementsCount: 12,
          totalPetitionsCount: 25,
          resolvedPetitionsCount: 18,
          pendingPetitionsCount: 4,
        },
      ],
    };

    expect(overview.neighborhoodCount).toBe(2);
    expect(overview.accountsByStatus.active).toBe(120);
    expect(overview.neighborhoodSummaries[0]?.code).toBe('KP-01');
  });

  it('should define valid NeighborhoodDetailSummaryDto structure', () => {
    const detail: NeighborhoodDetailSummaryDto = {
      neighborhood: {
        id: '99999999-9999-4999-9999-999999999991',
        code: 'KP-01',
        name: 'Khu phố 1',
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        city: 'TP. Hồ Chí Minh',
        description: 'Trung tâm phường',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      residentCount: 80,
      accountsByStatus: {
        active: 65,
        pending: 10,
        locked: 3,
        rejected: 2,
        total: 80,
      },
      publishedAnnouncementsCount: 12,
      currentMonthAnnouncementsCount: 4,
      petitionsByStatus: {
        reviewing: 4,
        processing: 3,
        resolved: 18,
        rejected: 0,
        cancelled: 0,
        total: 25,
      },
      petitionsByCategory: {
        [PetitionCategory.INFRASTRUCTURE]: 10,
        [PetitionCategory.SANITATION]: 8,
        [PetitionCategory.SECURITY]: 5,
        [PetitionCategory.OTHER]: 2,
      },
      recentAnnouncements: [
        {
          id: 'ann-1',
          title: 'Họp tổ dân phố',
          scope: 'neighborhood',
          status: 'published',
          authorName: 'Trần Văn Trưởng',
          authorRole: 'leader',
          createdAt: new Date().toISOString(),
        },
      ],
      recentPetitions: [
        {
          id: 'pet-1',
          title: 'Sửa đèn chiếu sáng',
          category: PetitionCategory.INFRASTRUCTURE,
          status: PetitionStatus.REVIEWING,
          authorName: 'Nguyễn Văn Cư Dân',
          authorRole: 'resident',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    expect(detail.neighborhood.code).toBe('KP-01');
    expect(detail.recentAnnouncements.length).toBe(1);
    expect(detail.petitionsByCategory[PetitionCategory.INFRASTRUCTURE]).toBe(10);
  });

  it('should define valid PetitionCategoryAnalyticsResponseDto structure', () => {
    const analytics: PetitionCategoryAnalyticsResponseDto = {
      total: 25,
      series: [
        {
          category: PetitionCategory.INFRASTRUCTURE,
          count: 10,
          percentage: 40,
          resolvedCount: 7,
        },
        {
          category: PetitionCategory.SANITATION,
          count: 8,
          percentage: 32,
          resolvedCount: 6,
        },
        {
          category: PetitionCategory.SECURITY,
          count: 5,
          percentage: 20,
          resolvedCount: 4,
        },
        {
          category: PetitionCategory.OTHER,
          count: 2,
          percentage: 8,
          resolvedCount: 1,
        },
      ],
      neighborhoodId: null,
      startDate: null,
      endDate: null,
    };

    expect(analytics.total).toBe(25);
    expect(analytics.series.length).toBe(4);
    expect(analytics.series[0]?.category).toBe(PetitionCategory.INFRASTRUCTURE);
    expect(analytics.series[1]?.category).toBe(PetitionCategory.SANITATION);
    expect(analytics.series[2]?.category).toBe(PetitionCategory.SECURITY);
    expect(analytics.series[3]?.category).toBe(PetitionCategory.OTHER);
  });
});
