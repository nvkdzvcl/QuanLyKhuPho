import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../core/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { ErrorCode, PetitionCategory } from '@quanlykhupho/shared-types';

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

  describe('getWardOverview', () => {
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
  });

  describe('getNeighborhoodDrillDown', () => {
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

  describe('getPetitionCategoryAnalytics', () => {
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

    it('should throw 400 when startDate > endDate', async () => {
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

    it('should throw 404 when neighborhoodId does not exist', async () => {
      vi.mocked(prisma.neighborhood.findUnique).mockResolvedValue(null);

      await expect(
        service.getPetitionCategoryAnalytics({
          neighborhoodId: '00000000-0000-4000-8000-000000000000',
        }),
      ).rejects.toThrow(AppException);
    });
  });
});
