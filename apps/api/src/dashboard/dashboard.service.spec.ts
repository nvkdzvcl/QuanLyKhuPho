import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../core/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { ErrorCode, PetitionCategory, ReportingPeriodType } from '@quanlykhupho/shared-types';

describe('DashboardService Unit Tests', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockNeighborhood1 = {
    id: '11111111-1111-4111-a111-111111111111',
    code: 'KP-01',
    name: 'Khu phố 1',
    ward: 'Phường Bến Nghé',
    district: 'Quận 1',
    city: 'TP. Hồ Chí Minh',
    description: 'Khu phố 1 trung tâm',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockNeighborhood2 = {
    id: '22222222-2222-4222-a222-222222222222',
    code: 'KP-02',
    name: 'Khu phố 2',
    ward: 'Phường Bến Nghé',
    district: 'Quận 1',
    city: 'TP. Hồ Chí Minh',
    description: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      neighborhood: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      account: {
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      petition: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      announcement: {
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
    } as unknown as PrismaService;

    service = new DashboardService(prisma);
  });

  describe('getWardOverview (FR-17)', () => {
    it('should aggregate ward-wide metrics and per-neighborhood metrics correctly', async () => {
      vi.mocked(prisma.neighborhood.findMany).mockResolvedValue([
        mockNeighborhood1,
        mockNeighborhood2,
      ]);

      // Ward-wide resident status counts
      vi.mocked(prisma.account.groupBy).mockImplementation((async (args: {
        by: readonly string[];
      }) => {
        if (args.by.includes('neighborhoodId')) {
          // Per neighborhood
          return [
            { neighborhoodId: mockNeighborhood1.id, status: 'active', _count: { id: 20 } },
            { neighborhoodId: mockNeighborhood1.id, status: 'pending', _count: { id: 5 } },
            { neighborhoodId: mockNeighborhood2.id, status: 'active', _count: { id: 15 } },
          ] as never;
        }
        // Ward-wide
        return [
          { status: 'active', _count: { id: 35 } },
          { status: 'pending', _count: { id: 5 } },
          { status: 'locked', _count: { id: 2 } },
          { status: 'rejected', _count: { id: 1 } },
        ] as never;
      }) as never);

      // Ward-wide petition status counts
      vi.mocked(prisma.petition.groupBy).mockImplementation((async (args: {
        by: readonly string[];
      }) => {
        if (args.by.includes('neighborhoodId')) {
          // Per neighborhood
          return [
            { neighborhoodId: mockNeighborhood1.id, status: 'reviewing', _count: { id: 3 } },
            { neighborhoodId: mockNeighborhood1.id, status: 'resolved', _count: { id: 7 } },
            { neighborhoodId: mockNeighborhood2.id, status: 'resolved', _count: { id: 4 } },
          ] as never;
        }
        return [
          { status: 'reviewing', _count: { id: 3 } },
          { status: 'processing', _count: { id: 2 } },
          { status: 'resolved', _count: { id: 11 } },
          { status: 'rejected', _count: { id: 1 } },
          { status: 'cancelled', _count: { id: 0 } },
        ] as never;
      }) as never);

      // Announcements
      vi.mocked(prisma.announcement.count).mockResolvedValue(4);
      vi.mocked(prisma.announcement.groupBy).mockResolvedValue([
        { neighborhoodId: mockNeighborhood1.id, _count: { id: 3 } },
        { neighborhoodId: mockNeighborhood2.id, _count: { id: 2 } },
      ] as never);

      const result = await service.getWardOverview();

      expect(result.neighborhoodCount).toBe(2);
      expect(result.residentCount).toBe(43);
      expect(result.accountsByStatus).toEqual({
        active: 35,
        pending: 5,
        locked: 2,
        rejected: 1,
        total: 43,
      });
      expect(result.petitionsByStatus).toEqual({
        reviewing: 3,
        processing: 2,
        resolved: 11,
        rejected: 1,
        cancelled: 0,
        total: 17,
      });
      expect(result.currentMonthAnnouncementsCount).toBe(4);
      expect(result.neighborhoodSummaries.length).toBe(2);

      const n1 = result.neighborhoodSummaries.find((n) => n.id === mockNeighborhood1.id);
      expect(n1).toBeDefined();
      expect(n1?.residentCount).toBe(25);
      expect(n1?.activeResidentCount).toBe(20);
      expect(n1?.pendingResidentCount).toBe(5);
      expect(n1?.publishedAnnouncementsCount).toBe(3);
      expect(n1?.totalPetitionsCount).toBe(10);
      expect(n1?.resolvedPetitionsCount).toBe(7);
      expect(n1?.pendingPetitionsCount).toBe(3);

      const n2 = result.neighborhoodSummaries.find((n) => n.id === mockNeighborhood2.id);
      expect(n2).toBeDefined();
      expect(n2?.residentCount).toBe(15);
      expect(n2?.activeResidentCount).toBe(15);
      expect(n2?.pendingResidentCount).toBe(0);
      expect(n2?.publishedAnnouncementsCount).toBe(2);
      expect(n2?.totalPetitionsCount).toBe(4);
      expect(n2?.resolvedPetitionsCount).toBe(4);
      expect(n2?.pendingPetitionsCount).toBe(0);
    });

    it('should handle zero records gracefully', async () => {
      vi.mocked(prisma.neighborhood.findMany).mockResolvedValue([]);
      vi.mocked(prisma.account.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.petition.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.announcement.count).mockResolvedValue(0);
      vi.mocked(prisma.announcement.groupBy).mockResolvedValue([]);

      const result = await service.getWardOverview();

      expect(result.neighborhoodCount).toBe(0);
      expect(result.residentCount).toBe(0);
      expect(result.accountsByStatus.total).toBe(0);
      expect(result.petitionsByStatus.total).toBe(0);
      expect(result.currentMonthAnnouncementsCount).toBe(0);
      expect(result.neighborhoodSummaries).toEqual([]);
    });

    it('should return safe zero metrics for neighborhoods with zero activity', async () => {
      vi.mocked(prisma.neighborhood.findMany).mockResolvedValue([
        mockNeighborhood1,
        mockNeighborhood2,
      ]);

      vi.mocked(prisma.account.groupBy).mockImplementation((async (args: {
        by: readonly string[];
      }) => {
        if (args.by.includes('neighborhoodId')) {
          return [
            { neighborhoodId: mockNeighborhood1.id, status: 'active', _count: { id: 10 } },
          ] as never;
        }
        return [{ status: 'active', _count: { id: 10 } }] as never;
      }) as never);

      vi.mocked(prisma.petition.groupBy).mockImplementation((async (args: {
        by: readonly string[];
      }) => {
        if (args.by.includes('neighborhoodId')) {
          return [
            { neighborhoodId: mockNeighborhood1.id, status: 'resolved', _count: { id: 2 } },
          ] as never;
        }
        return [{ status: 'resolved', _count: { id: 2 } }] as never;
      }) as never);

      vi.mocked(prisma.announcement.count).mockResolvedValue(1);
      vi.mocked(prisma.announcement.groupBy).mockResolvedValue([
        { neighborhoodId: mockNeighborhood1.id, _count: { id: 1 } },
      ] as never);

      const result = await service.getWardOverview();
      const n2 = result.neighborhoodSummaries.find((n) => n.id === mockNeighborhood2.id);

      expect(n2).toBeDefined();
      expect(n2?.residentCount).toBe(0);
      expect(n2?.activeResidentCount).toBe(0);
      expect(n2?.pendingResidentCount).toBe(0);
      expect(n2?.publishedAnnouncementsCount).toBe(0);
      expect(n2?.totalPetitionsCount).toBe(0);
      expect(n2?.resolvedPetitionsCount).toBe(0);
      expect(n2?.pendingPetitionsCount).toBe(0);
    });
  });

  describe('getNeighborhoodDrillDown (FR-18)', () => {
    it('should return detailed metrics for a valid neighborhood', async () => {
      vi.mocked(prisma.neighborhood.findUnique).mockResolvedValue(mockNeighborhood1);

      vi.mocked(prisma.account.groupBy).mockResolvedValue([
        { status: 'active', _count: { id: 18 } },
        { status: 'pending', _count: { id: 2 } },
      ] as never);

      vi.mocked(prisma.announcement.count).mockResolvedValueOnce(6).mockResolvedValueOnce(2);

      vi.mocked(prisma.petition.groupBy).mockImplementation((async (args: {
        by: readonly string[];
      }) => {
        if (args.by.includes('category')) {
          return [
            { category: 'infrastructure', _count: { id: 5 } },
            { category: 'sanitation', _count: { id: 3 } },
          ] as never;
        }
        return [
          { status: 'reviewing', _count: { id: 2 } },
          { status: 'resolved', _count: { id: 6 } },
        ] as never;
      }) as never);

      vi.mocked(prisma.announcement.findMany).mockResolvedValue([
        {
          id: 'ann-1',
          title: 'Họp dân phố',
          scope: 'neighborhood',
          status: 'published',
          createdAt: new Date('2026-08-01T10:00:00Z'),
          author: { fullName: 'Trưởng Khu Phố', role: 'leader' },
        } as never,
      ]);

      vi.mocked(prisma.petition.findMany).mockResolvedValue([
        {
          id: 'pet-1',
          title: 'Cống tắc',
          category: 'sanitation',
          status: 'reviewing',
          createdAt: new Date('2026-08-02T10:00:00Z'),
          author: { fullName: 'Cư Dân A', role: 'resident' },
        } as never,
      ]);

      const result = await service.getNeighborhoodDrillDown(mockNeighborhood1.id);

      expect(result.neighborhood.id).toBe(mockNeighborhood1.id);
      expect(result.residentCount).toBe(20);
      expect(result.accountsByStatus.active).toBe(18);
      expect(result.publishedAnnouncementsCount).toBe(6);
      expect(result.currentMonthAnnouncementsCount).toBe(2);
      expect(result.petitionsByStatus.reviewing).toBe(2);
      expect(result.petitionsByStatus.resolved).toBe(6);
      expect(result.petitionsByCategory[PetitionCategory.INFRASTRUCTURE]).toBe(5);
      expect(result.petitionsByCategory[PetitionCategory.SANITATION]).toBe(3);
      expect(result.petitionsByCategory[PetitionCategory.SECURITY]).toBe(0);
      expect(result.petitionsByCategory[PetitionCategory.OTHER]).toBe(0);
      expect(result.recentAnnouncements.length).toBe(1);
      expect(result.recentPetitions.length).toBe(1);
      expect(result.recentPetitions[0]?.authorName).toBe('Cư Dân A');
    });

    it('should return safe zero defaults for a neighborhood with zero activity', async () => {
      vi.mocked(prisma.neighborhood.findUnique).mockResolvedValue(mockNeighborhood2);
      vi.mocked(prisma.account.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.announcement.count).mockResolvedValue(0);
      vi.mocked(prisma.petition.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.announcement.findMany).mockResolvedValue([]);
      vi.mocked(prisma.petition.findMany).mockResolvedValue([]);

      const result = await service.getNeighborhoodDrillDown(mockNeighborhood2.id);

      expect(result.neighborhood.id).toBe(mockNeighborhood2.id);
      expect(result.residentCount).toBe(0);
      expect(result.accountsByStatus).toEqual({
        active: 0,
        pending: 0,
        locked: 0,
        rejected: 0,
        total: 0,
      });
      expect(result.publishedAnnouncementsCount).toBe(0);
      expect(result.currentMonthAnnouncementsCount).toBe(0);
      expect(result.petitionsByStatus).toEqual({
        reviewing: 0,
        processing: 0,
        resolved: 0,
        rejected: 0,
        cancelled: 0,
        total: 0,
      });
      expect(result.petitionsByCategory).toEqual({
        [PetitionCategory.INFRASTRUCTURE]: 0,
        [PetitionCategory.SANITATION]: 0,
        [PetitionCategory.SECURITY]: 0,
        [PetitionCategory.OTHER]: 0,
      });
      expect(result.recentAnnouncements).toEqual([]);
      expect(result.recentPetitions).toEqual([]);
    });

    it('should throw 404 if neighborhood is not found', async () => {
      vi.mocked(prisma.neighborhood.findUnique).mockResolvedValue(null);

      await expect(
        service.getNeighborhoodDrillDown('00000000-0000-4000-8000-000000000000'),
      ).rejects.toThrow(AppException);

      try {
        await service.getNeighborhoodDrillDown('00000000-0000-4000-8000-000000000000');
      } catch (err: unknown) {
        if (!(err instanceof AppException)) throw err;
        expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(err.errorCode).toBe(ErrorCode.NEIGHBORHOOD_NOT_FOUND);
      }
    });
  });

  describe('getPetitionCategoryAnalytics (FR-19)', () => {
    it('should return all 4 categories in stable order with zero-filling', async () => {
      vi.mocked(prisma.petition.groupBy).mockImplementation((async (args: {
        where?: { status?: string };
      }) => {
        if (args.where?.status === 'resolved') {
          return [
            { category: 'infrastructure', _count: { id: 3 } },
            { category: 'security', _count: { id: 2 } },
          ] as never;
        }
        return [
          { category: 'infrastructure', _count: { id: 5 } },
          { category: 'security', _count: { id: 5 } },
        ] as never;
      }) as never);

      const result = await service.getPetitionCategoryAnalytics({});

      expect(result.total).toBe(10);
      expect(result.series.length).toBe(4);
      expect(result.series.map((s) => s.category)).toEqual([
        PetitionCategory.INFRASTRUCTURE,
        PetitionCategory.SANITATION,
        PetitionCategory.SECURITY,
        PetitionCategory.OTHER,
      ]);

      const infra = result.series[0];
      expect(infra?.category).toBe(PetitionCategory.INFRASTRUCTURE);
      expect(infra?.count).toBe(5);
      expect(infra?.percentage).toBe(50);
      expect(infra?.resolvedCount).toBe(3);

      const sanitation = result.series[1];
      expect(sanitation?.category).toBe(PetitionCategory.SANITATION);
      expect(sanitation?.count).toBe(0);
      expect(sanitation?.percentage).toBe(0);
      expect(sanitation?.resolvedCount).toBe(0);

      const security = result.series[2];
      expect(security?.category).toBe(PetitionCategory.SECURITY);
      expect(security?.count).toBe(5);
      expect(security?.percentage).toBe(50);
      expect(security?.resolvedCount).toBe(2);

      const other = result.series[3];
      expect(other?.category).toBe(PetitionCategory.OTHER);
      expect(other?.count).toBe(0);
      expect(other?.percentage).toBe(0);
    });

    it('should handle zero petitions gracefully without NaN or division by zero', async () => {
      vi.mocked(prisma.petition.groupBy).mockResolvedValue([]);

      const result = await service.getPetitionCategoryAnalytics({});

      expect(result.total).toBe(0);
      expect(result.series.length).toBe(4);
      for (const item of result.series) {
        expect(item.count).toBe(0);
        expect(item.percentage).toBe(0);
        expect(item.resolvedCount).toBe(0);
      }
    });

    it('should filter by neighborhoodId when provided', async () => {
      vi.mocked(prisma.neighborhood.findUnique).mockResolvedValue(mockNeighborhood1);
      vi.mocked(prisma.petition.groupBy).mockResolvedValue([]);

      const result = await service.getPetitionCategoryAnalytics({
        neighborhoodId: mockNeighborhood1.id,
      });

      expect(result.neighborhoodId).toBe(mockNeighborhood1.id);
      expect(prisma.petition.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            neighborhoodId: mockNeighborhood1.id,
          }),
        }),
      );
    });

    it('should throw 400 when startDate > endDate with date-only strings', async () => {
      await expect(
        service.getPetitionCategoryAnalytics({
          startDate: '2026-08-20',
          endDate: '2026-08-10',
        }),
      ).rejects.toThrow(AppException);

      try {
        await service.getPetitionCategoryAnalytics({
          startDate: '2026-08-20',
          endDate: '2026-08-10',
        });
      } catch (err: unknown) {
        if (!(err instanceof AppException)) throw err;
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('should throw 400 when startDate is 1 day after endDate (boundary date-only check)', async () => {
      await expect(
        service.getPetitionCategoryAnalytics({
          startDate: '2026-08-11',
          endDate: '2026-08-10',
        }),
      ).rejects.toThrow(AppException);
    });

    it('should throw 400 when startDate > endDate with ISO datetime strings', async () => {
      await expect(
        service.getPetitionCategoryAnalytics({
          startDate: '2026-08-10T12:00:00Z',
          endDate: '2026-08-10T10:00:00Z',
        }),
      ).rejects.toThrow(AppException);
    });

    it('should allow same-day date-only filter and set next-day exclusive boundary', async () => {
      vi.mocked(prisma.petition.groupBy).mockResolvedValue([]);

      const result = await service.getPetitionCategoryAnalytics({
        startDate: '2026-08-10',
        endDate: '2026-08-10',
      });

      expect(result.startDate).toBe('2026-08-10');
      expect(result.endDate).toBe('2026-08-10');
      expect(prisma.petition.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-08-10T00:00:00.000Z'),
              lt: new Date('2026-08-11T00:00:00.000Z'),
            },
          }),
        }),
      );
    });

    it('should throw 400 for malformed date strings', async () => {
      await expect(
        service.getPetitionCategoryAnalytics({
          startDate: 'invalid-date',
        }),
      ).rejects.toThrow(AppException);

      await expect(
        service.getPetitionCategoryAnalytics({
          endDate: 'invalid-date',
        }),
      ).rejects.toThrow(AppException);
    });

    it('should throw 404 when neighborhoodId does not exist', async () => {
      vi.mocked(prisma.neighborhood.findUnique).mockResolvedValue(null);

      await expect(
        service.getPetitionCategoryAnalytics({
          neighborhoodId: '00000000-0000-4000-8000-000000000000',
        }),
      ).rejects.toThrow(AppException);
    });
  });

  describe('getPeriodicReport (FR-20)', () => {
    it('should generate a monthly report with accurate aggregates and stable neighborhood rows for past period', async () => {
      vi.mocked(prisma.neighborhood.findMany).mockResolvedValue([
        mockNeighborhood1,
        mockNeighborhood2,
      ]);

      // Active residents snapshot: 40 total
      vi.mocked(prisma.account.count).mockImplementation((async (args: {
        where?: { createdAt?: unknown };
      }) => {
        if (args?.where?.createdAt) {
          // New resident registrations in period
          return 8;
        }
        // Active resident snapshot
        return 40;
      }) as never);

      // Active residents by neighborhood
      vi.mocked(prisma.account.groupBy).mockImplementation((async (args: {
        where?: { createdAt?: unknown };
      }) => {
        if (args?.where?.createdAt) {
          // New registrations by neighborhood
          return [
            { neighborhoodId: mockNeighborhood1.id, _count: { id: 5 } },
            { neighborhoodId: mockNeighborhood2.id, _count: { id: 3 } },
          ] as never;
        }
        // Active residents by neighborhood
        return [
          { neighborhoodId: mockNeighborhood1.id, _count: { id: 25 } },
          { neighborhoodId: mockNeighborhood2.id, _count: { id: 15 } },
        ] as never;
      }) as never);

      // Announcements
      vi.mocked(prisma.announcement.count).mockResolvedValue(4);
      vi.mocked(prisma.announcement.groupBy).mockResolvedValue([
        { neighborhoodId: mockNeighborhood1.id, _count: { id: 3 } },
        { neighborhoodId: mockNeighborhood2.id, _count: { id: 1 } },
      ] as never);

      // Petitions
      vi.mocked(prisma.petition.groupBy).mockImplementation((async (args: {
        by: readonly string[];
      }) => {
        if (args.by.includes('neighborhoodId')) {
          return [
            { neighborhoodId: mockNeighborhood1.id, status: 'resolved', _count: { id: 4 } },
            { neighborhoodId: mockNeighborhood1.id, status: 'reviewing', _count: { id: 2 } },
            { neighborhoodId: mockNeighborhood2.id, status: 'processing', _count: { id: 1 } },
          ] as never;
        }
        return [
          { status: 'resolved', _count: { id: 4 } },
          { status: 'reviewing', _count: { id: 2 } },
          { status: 'processing', _count: { id: 1 } },
        ] as never;
      }) as never);

      const result = await service.getPeriodicReport({
        periodType: ReportingPeriodType.MONTH,
        year: 2026,
        period: 1, // January 2026 (past period)
      });

      expect(result.periodType).toBe(ReportingPeriodType.MONTH);
      expect(result.year).toBe(2026);
      expect(result.period).toBe(1);
      expect(result.label).toBe('Tháng 1/2026');
      expect(result.startDate).toBe('2026-01-01T00:00:00.000Z');
      expect(result.endDateExclusive).toBe('2026-02-01T00:00:00.000Z');
      expect(result.isDataSufficient).toBe(true);
      expect(result.warnings).toEqual([]);

      // Ward summary
      expect(result.summary.neighborhoodCount).toBe(2);
      expect(result.summary.activeResidentCount).toBe(40);
      expect(result.summary.newResidentRegistrationsCount).toBe(8);
      expect(result.summary.publishedAnnouncementsCount).toBe(4);
      expect(result.summary.petitionsByStatus).toEqual({
        reviewing: 2,
        processing: 1,
        resolved: 4,
        rejected: 0,
        cancelled: 0,
        total: 7,
      });

      // Neighborhood rows
      expect(result.neighborhoods.length).toBe(2);
      const kp1 = result.neighborhoods[0];
      expect(kp1?.code).toBe('KP-01');
      expect(kp1?.activeResidentCount).toBe(25);
      expect(kp1?.newResidentRegistrationsCount).toBe(5);
      expect(kp1?.publishedAnnouncementsCount).toBe(3);
      expect(kp1?.petitionsByStatus).toEqual({
        reviewing: 2,
        processing: 0,
        resolved: 4,
        rejected: 0,
        cancelled: 0,
        total: 6,
      });

      const kp2 = result.neighborhoods[1];
      expect(kp2?.code).toBe('KP-02');
      expect(kp2?.activeResidentCount).toBe(15);
      expect(kp2?.newResidentRegistrationsCount).toBe(3);
      expect(kp2?.publishedAnnouncementsCount).toBe(1);
      expect(kp2?.petitionsByStatus).toEqual({
        reviewing: 0,
        processing: 1,
        resolved: 0,
        rejected: 0,
        cancelled: 0,
        total: 1,
      });

      // Confirm no sensitive fields are present in the output
      const jsonStr = JSON.stringify(result);
      expect(jsonStr).not.toContain('phone');
      expect(jsonStr).not.toContain('password');
      expect(jsonStr).not.toContain('citizenId');
    });

    it('should generate a quarterly report with accurate quarterly date range and label', async () => {
      vi.mocked(prisma.neighborhood.findMany).mockResolvedValue([mockNeighborhood1]);
      vi.mocked(prisma.account.count).mockResolvedValue(10);
      vi.mocked(prisma.account.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.announcement.count).mockResolvedValue(2);
      vi.mocked(prisma.announcement.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.petition.groupBy).mockResolvedValue([]);

      const resultQ1 = await service.getPeriodicReport({
        periodType: ReportingPeriodType.QUARTER,
        year: 2026,
        period: 1, // Q1 2026: 2026-01-01 to 2026-04-01
      });

      expect(resultQ1.periodType).toBe(ReportingPeriodType.QUARTER);
      expect(resultQ1.year).toBe(2026);
      expect(resultQ1.period).toBe(1);
      expect(resultQ1.label).toBe('Quý 1/2026');
      expect(resultQ1.startDate).toBe('2026-01-01T00:00:00.000Z');
      expect(resultQ1.endDateExclusive).toBe('2026-04-01T00:00:00.000Z');

      const resultQ2 = await service.getPeriodicReport({
        periodType: ReportingPeriodType.QUARTER,
        year: 2026,
        period: 2, // Q2 2026: 2026-04-01 to 2026-07-01
      });
      expect(resultQ2.label).toBe('Quý 2/2026');
      expect(resultQ2.startDate).toBe('2026-04-01T00:00:00.000Z');
      expect(resultQ2.endDateExclusive).toBe('2026-07-01T00:00:00.000Z');
    });

    it('should flag in-progress warning when report period covers current date', async () => {
      vi.mocked(prisma.neighborhood.findMany).mockResolvedValue([mockNeighborhood1]);
      vi.mocked(prisma.account.count).mockResolvedValue(5);
      vi.mocked(prisma.account.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.announcement.count).mockResolvedValue(1);
      vi.mocked(prisma.announcement.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.petition.groupBy).mockResolvedValue([]);

      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1;

      const result = await service.getPeriodicReport({
        periodType: ReportingPeriodType.MONTH,
        year: currentYear,
        period: currentMonth,
      });

      expect(result.isDataSufficient).toBe(false);
      expect(result.warnings.some((w) => w.includes('đang diễn ra'))).toBe(true);
    });

    it('should reject invalid period values with 400 Bad Request', async () => {
      // Month out of range (> 12)
      await expect(
        service.getPeriodicReport({
          periodType: ReportingPeriodType.MONTH,
          year: 2026,
          period: 13,
        }),
      ).rejects.toThrow(AppException);

      // Month < 1
      await expect(
        service.getPeriodicReport({
          periodType: ReportingPeriodType.MONTH,
          year: 2026,
          period: 0,
        }),
      ).rejects.toThrow(AppException);

      // Quarter > 4
      await expect(
        service.getPeriodicReport({
          periodType: ReportingPeriodType.QUARTER,
          year: 2026,
          period: 5,
        }),
      ).rejects.toThrow(AppException);

      // Quarter < 1
      await expect(
        service.getPeriodicReport({
          periodType: ReportingPeriodType.QUARTER,
          year: 2026,
          period: 0,
        }),
      ).rejects.toThrow(AppException);
    });

    it('should reject invalid year with 400 Bad Request', async () => {
      await expect(
        service.getPeriodicReport({
          periodType: ReportingPeriodType.MONTH,
          year: 1999,
          period: 1,
        }),
      ).rejects.toThrow(AppException);

      await expect(
        service.getPeriodicReport({
          periodType: ReportingPeriodType.MONTH,
          year: 2101,
          period: 1,
        }),
      ).rejects.toThrow(AppException);
    });

    it('should reject invalid periodType with 400 Bad Request', async () => {
      await expect(
        service.getPeriodicReport({
          periodType: 'annual' as never,
          year: 2026,
          period: 1,
        }),
      ).rejects.toThrow(AppException);
    });

    it('should reject future period with 400 Bad Request', async () => {
      const nextYear = new Date().getUTCFullYear() + 1;
      await expect(
        service.getPeriodicReport({
          periodType: ReportingPeriodType.MONTH,
          year: nextYear,
          period: 1,
        }),
      ).rejects.toThrow(AppException);
    });

    it('should emit warnings when ward has no neighborhoods or no activity', async () => {
      vi.mocked(prisma.neighborhood.findMany).mockResolvedValue([]);
      vi.mocked(prisma.account.count).mockResolvedValue(0);
      vi.mocked(prisma.account.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.announcement.count).mockResolvedValue(0);
      vi.mocked(prisma.announcement.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.petition.groupBy).mockResolvedValue([]);

      const result = await service.getPeriodicReport({
        periodType: ReportingPeriodType.MONTH,
        year: 2026,
        period: 1,
      });

      expect(result.isDataSufficient).toBe(false);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings.some((w) => w.includes('khu phố'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('phát sinh'))).toBe(true);
    });
  });
});
