import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AccountStatusSummaryDto,
  DashboardPetitionCategoriesQueryDto,
  ErrorCode,
  NeighborhoodDetailSummaryDto,
  NeighborhoodQuickMetricsDto,
  PetitionCategory,
  PetitionCategoryAnalyticsResponseDto,
  PetitionCategorySeriesItemDto,
  PetitionStatus,
  PetitionStatusSummaryDto,
  RecentAnnouncementItemDto,
  RecentPetitionItemDto,
  WardOverviewDto,
} from '@quanlykhupho/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../core/exceptions/app.exception';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getCurrentMonthRange(): {
    startOfMonth: Date;
    startOfNextMonth: Date;
  } {
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const startOfNextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    );
    return { startOfMonth, startOfNextMonth };
  }

  private parseDateRange(
    startDateStr?: string,
    endDateStr?: string,
  ): { startDate?: Date; endDate?: Date; endDateIsExclusive: boolean } {
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let endDateIsExclusive = false;

    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        throw new AppException(
          'Ngày bắt đầu không hợp lệ',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    if (endDateStr) {
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        throw new AppException(
          'Ngày kết thúc không hợp lệ',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      // Date-only filters include the complete selected day. An exclusive next-day
      // boundary also covers PostgreSQL timestamps with sub-millisecond precision.
      if (/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        endDateIsExclusive = true;
      }
    }

    if (startDate && endDate && startDate > endDate) {
      throw new AppException(
        'Ngày bắt đầu không được lớn hơn ngày kết thúc',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    return { startDate, endDate, endDateIsExclusive };
  }

  /**
   * FR-17: Get Ward-level overview metrics and per-neighborhood summary list.
   */
  async getWardOverview(): Promise<WardOverviewDto> {
    const { startOfMonth, startOfNextMonth } = this.getCurrentMonthRange();

    // 1. Fetch all neighborhoods
    const neighborhoods = await this.prisma.neighborhood.findMany({
      orderBy: { code: 'asc' },
    });

    // 2. Aggregate resident accounts ward-wide (role = 'resident')
    const residentStatusGroups = await this.prisma.account.groupBy({
      by: ['status'],
      where: { role: 'resident' },
      _count: { id: true },
    });

    const accountsByStatus: AccountStatusSummaryDto = {
      active: 0,
      pending: 0,
      locked: 0,
      rejected: 0,
      total: 0,
    };

    for (const group of residentStatusGroups) {
      const statusKey = group.status as keyof Omit<
        AccountStatusSummaryDto,
        'total'
      >;
      if (statusKey in accountsByStatus) {
        accountsByStatus[statusKey] = group._count.id;
      }
    }
    accountsByStatus.total =
      accountsByStatus.active +
      accountsByStatus.pending +
      accountsByStatus.locked +
      accountsByStatus.rejected;

    // 3. Aggregate petitions ward-wide
    const petitionStatusGroups = await this.prisma.petition.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const petitionsByStatus: PetitionStatusSummaryDto = {
      reviewing: 0,
      processing: 0,
      resolved: 0,
      rejected: 0,
      cancelled: 0,
      total: 0,
    };

    for (const group of petitionStatusGroups) {
      const statusKey = group.status as keyof Omit<
        PetitionStatusSummaryDto,
        'total'
      >;
      if (statusKey in petitionsByStatus) {
        petitionsByStatus[statusKey] = group._count.id;
      }
    }
    petitionsByStatus.total =
      petitionsByStatus.reviewing +
      petitionsByStatus.processing +
      petitionsByStatus.resolved +
      petitionsByStatus.rejected +
      petitionsByStatus.cancelled;

    // 4. Current month published announcements count
    const currentMonthAnnouncementsCount =
      await this.prisma.announcement.count({
        where: {
          status: 'published',
          createdAt: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
      });

    // 5. Per-neighborhood quick metrics via efficient group-bys
    const residentByNeighborhood = await this.prisma.account.groupBy({
      by: ['neighborhoodId', 'status'],
      where: {
        role: 'resident',
        neighborhoodId: { not: null },
      },
      _count: { id: true },
    });

    const announcementsByNeighborhood = await this.prisma.announcement.groupBy({
      by: ['neighborhoodId'],
      where: {
        status: 'published',
        neighborhoodId: { not: null },
      },
      _count: { id: true },
    });

    const petitionsByNeighborhood = await this.prisma.petition.groupBy({
      by: ['neighborhoodId', 'status'],
      _count: { id: true },
    });

    // Map aggregates into per-neighborhood metrics
    const neighborhoodSummaries: NeighborhoodQuickMetricsDto[] =
      neighborhoods.map((n) => {
        // Residents
        const nResidents = residentByNeighborhood.filter(
          (r) => r.neighborhoodId === n.id,
        );
        let residentCount = 0;
        let activeResidentCount = 0;
        let pendingResidentCount = 0;
        for (const item of nResidents) {
          residentCount += item._count.id;
          if (item.status === 'active') {
            activeResidentCount += item._count.id;
          } else if (item.status === 'pending') {
            pendingResidentCount += item._count.id;
          }
        }

        // Published announcements
        const nAnnouncements = announcementsByNeighborhood.find(
          (a) => a.neighborhoodId === n.id,
        );
        const publishedAnnouncementsCount = nAnnouncements?._count.id || 0;

        // Petitions
        const nPetitions = petitionsByNeighborhood.filter(
          (p) => p.neighborhoodId === n.id,
        );
        let totalPetitionsCount = 0;
        let resolvedPetitionsCount = 0;
        let pendingPetitionsCount = 0;
        for (const item of nPetitions) {
          totalPetitionsCount += item._count.id;
          if (item.status === 'resolved') {
            resolvedPetitionsCount += item._count.id;
          } else if (
            item.status === 'reviewing' ||
            item.status === 'processing'
          ) {
            pendingPetitionsCount += item._count.id;
          }
        }

        return {
          id: n.id,
          code: n.code,
          name: n.name,
          ward: n.ward,
          residentCount,
          activeResidentCount,
          pendingResidentCount,
          publishedAnnouncementsCount,
          totalPetitionsCount,
          resolvedPetitionsCount,
          pendingPetitionsCount,
        };
      });

    return {
      neighborhoodCount: neighborhoods.length,
      residentCount: accountsByStatus.total,
      accountsByStatus,
      petitionsByStatus,
      currentMonthAnnouncementsCount,
      neighborhoodSummaries,
    };
  }

  /**
   * FR-18: Get Neighborhood drill-down details, metrics, and recent activity items.
   */
  async getNeighborhoodDrillDown(
    neighborhoodId: string,
  ): Promise<NeighborhoodDetailSummaryDto> {
    const { startOfMonth, startOfNextMonth } = this.getCurrentMonthRange();

    // 1. Check neighborhood existence
    const neighborhood = await this.prisma.neighborhood.findUnique({
      where: { id: neighborhoodId },
    });

    if (!neighborhood) {
      throw new AppException(
        'Không tìm thấy thông tin khu phố',
        HttpStatus.NOT_FOUND,
        ErrorCode.NEIGHBORHOOD_NOT_FOUND,
      );
    }

    // 2. Residents status breakdown in this neighborhood
    const residentStatusGroups = await this.prisma.account.groupBy({
      by: ['status'],
      where: {
        neighborhoodId,
        role: 'resident',
      },
      _count: { id: true },
    });

    const accountsByStatus: AccountStatusSummaryDto = {
      active: 0,
      pending: 0,
      locked: 0,
      rejected: 0,
      total: 0,
    };

    for (const group of residentStatusGroups) {
      const statusKey = group.status as keyof Omit<
        AccountStatusSummaryDto,
        'total'
      >;
      if (statusKey in accountsByStatus) {
        accountsByStatus[statusKey] = group._count.id;
      }
    }
    accountsByStatus.total =
      accountsByStatus.active +
      accountsByStatus.pending +
      accountsByStatus.locked +
      accountsByStatus.rejected;

    // 3. Published announcements counts
    const publishedAnnouncementsCount = await this.prisma.announcement.count({
      where: {
        neighborhoodId,
        status: 'published',
      },
    });

    const currentMonthAnnouncementsCount =
      await this.prisma.announcement.count({
        where: {
          neighborhoodId,
          status: 'published',
          createdAt: {
            gte: startOfMonth,
            lt: startOfNextMonth,
          },
        },
      });

    // 4. Petitions status breakdown
    const petitionStatusGroups = await this.prisma.petition.groupBy({
      by: ['status'],
      where: { neighborhoodId },
      _count: { id: true },
    });

    const petitionsByStatus: PetitionStatusSummaryDto = {
      reviewing: 0,
      processing: 0,
      resolved: 0,
      rejected: 0,
      cancelled: 0,
      total: 0,
    };

    for (const group of petitionStatusGroups) {
      const statusKey = group.status as keyof Omit<
        PetitionStatusSummaryDto,
        'total'
      >;
      if (statusKey in petitionsByStatus) {
        petitionsByStatus[statusKey] = group._count.id;
      }
    }
    petitionsByStatus.total =
      petitionsByStatus.reviewing +
      petitionsByStatus.processing +
      petitionsByStatus.resolved +
      petitionsByStatus.rejected +
      petitionsByStatus.cancelled;

    // 5. Petitions category breakdown
    const petitionCategoryGroups = await this.prisma.petition.groupBy({
      by: ['category'],
      where: { neighborhoodId },
      _count: { id: true },
    });

    const petitionsByCategory: Record<PetitionCategory, number> = {
      [PetitionCategory.INFRASTRUCTURE]: 0,
      [PetitionCategory.SANITATION]: 0,
      [PetitionCategory.SECURITY]: 0,
      [PetitionCategory.OTHER]: 0,
    };

    for (const group of petitionCategoryGroups) {
      const categoryKey = group.category as PetitionCategory;
      if (categoryKey in petitionsByCategory) {
        petitionsByCategory[categoryKey] = group._count.id;
      }
    }

    // 6. Recent published announcements (safe fields only)
    const recentAnnouncementsRaw = await this.prisma.announcement.findMany({
      where: {
        neighborhoodId,
        status: 'published',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        scope: true,
        status: true,
        createdAt: true,
        author: {
          select: {
            fullName: true,
            role: true,
          },
        },
      },
    });

    const recentAnnouncements: RecentAnnouncementItemDto[] =
      recentAnnouncementsRaw.map((a) => ({
        id: a.id,
        title: a.title,
        scope: a.scope,
        status: a.status,
        authorName: a.author.fullName,
        authorRole: a.author.role,
        createdAt: a.createdAt.toISOString(),
      }));

    // 7. Recent petitions (safe fields only)
    const recentPetitionsRaw = await this.prisma.petition.findMany({
      where: { neighborhoodId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        createdAt: true,
        author: {
          select: {
            fullName: true,
            role: true,
          },
        },
      },
    });

    const recentPetitions: RecentPetitionItemDto[] = recentPetitionsRaw.map(
      (p) => ({
        id: p.id,
        title: p.title,
        category: p.category as PetitionCategory,
        status: p.status as PetitionStatus,
        authorName: p.author.fullName,
        authorRole: p.author.role,
        createdAt: p.createdAt.toISOString(),
      }),
    );

    return {
      neighborhood: {
        id: neighborhood.id,
        code: neighborhood.code,
        name: neighborhood.name,
        ward: neighborhood.ward,
        district: neighborhood.district,
        city: neighborhood.city,
        description: neighborhood.description,
        createdAt: neighborhood.createdAt.toISOString(),
        updatedAt: neighborhood.updatedAt.toISOString(),
      },
      residentCount: accountsByStatus.total,
      accountsByStatus,
      publishedAnnouncementsCount,
      currentMonthAnnouncementsCount,
      petitionsByStatus,
      petitionsByCategory,
      recentAnnouncements,
      recentPetitions,
    };
  }

  /**
   * FR-19: Get petition-category series analytics with zero-filled counts in stable order.
   */
  async getPetitionCategoryAnalytics(
    query: DashboardPetitionCategoriesQueryDto,
  ): Promise<PetitionCategoryAnalyticsResponseDto> {
    const { neighborhoodId, startDate: startDateStr, endDate: endDateStr } = query;

    // 1. Verify neighborhood if provided
    if (neighborhoodId) {
      const neighborhood = await this.prisma.neighborhood.findUnique({
        where: { id: neighborhoodId },
      });
      if (!neighborhood) {
        throw new AppException(
          'Không tìm thấy thông tin khu phố',
          HttpStatus.NOT_FOUND,
          ErrorCode.NEIGHBORHOOD_NOT_FOUND,
        );
      }
    }

    // 2. Parse and validate date filters
    const { startDate, endDate, endDateIsExclusive } = this.parseDateRange(
      startDateStr,
      endDateStr,
    );

    // 3. Build Prisma where clause
    const where: {
      neighborhoodId?: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
        lt?: Date;
      };
    } = {};

    if (neighborhoodId) {
      where.neighborhoodId = neighborhoodId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        if (endDateIsExclusive) {
          where.createdAt.lt = endDate;
        } else {
          where.createdAt.lte = endDate;
        }
      }
    }

    // 4. Group by category for total counts
    const categoryCounts = await this.prisma.petition.groupBy({
      by: ['category'],
      where,
      _count: { id: true },
    });

    // 5. Group by category for resolved counts
    const resolvedCategoryCounts = await this.prisma.petition.groupBy({
      by: ['category'],
      where: {
        ...where,
        status: 'resolved',
      },
      _count: { id: true },
    });

    // 6. Map results into counts map
    const countMap: Record<PetitionCategory, number> = {
      [PetitionCategory.INFRASTRUCTURE]: 0,
      [PetitionCategory.SANITATION]: 0,
      [PetitionCategory.SECURITY]: 0,
      [PetitionCategory.OTHER]: 0,
    };

    const resolvedMap: Record<PetitionCategory, number> = {
      [PetitionCategory.INFRASTRUCTURE]: 0,
      [PetitionCategory.SANITATION]: 0,
      [PetitionCategory.SECURITY]: 0,
      [PetitionCategory.OTHER]: 0,
    };

    let total = 0;
    for (const item of categoryCounts) {
      const cat = item.category as PetitionCategory;
      if (cat in countMap) {
        countMap[cat] = item._count.id;
        total += item._count.id;
      }
    }

    for (const item of resolvedCategoryCounts) {
      const cat = item.category as PetitionCategory;
      if (cat in resolvedMap) {
        resolvedMap[cat] = item._count.id;
      }
    }

    // 7. Stable order series output: infrastructure, sanitation, security, other
    const orderedCategories: PetitionCategory[] = [
      PetitionCategory.INFRASTRUCTURE,
      PetitionCategory.SANITATION,
      PetitionCategory.SECURITY,
      PetitionCategory.OTHER,
    ];

    const series: PetitionCategorySeriesItemDto[] = orderedCategories.map(
      (category) => {
        const count = countMap[category] || 0;
        const percentage =
          total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
        const resolvedCount = resolvedMap[category] || 0;

        return {
          category,
          count,
          percentage,
          resolvedCount,
        };
      },
    );

    return {
      total,
      series,
      neighborhoodId: neighborhoodId || null,
      startDate: startDateStr || null,
      endDate: endDateStr || null,
    };
  }
}
