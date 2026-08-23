import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import {
  AccountStatus,
  ErrorCode,
  HighestEducation,
  PartyStatus,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { PoliticalSocialProfilesService } from './political-social-profiles.service';
import { UpsertPoliticalSocialProfileDto } from './dto/upsert-political-social-profile.dto';

interface MockPrisma {
  residentProfile: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  politicalSocialProfile: {
    upsert: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

describe('PoliticalSocialProfilesService', () => {
  let service: PoliticalSocialProfilesService;
  let mockPrisma: MockPrisma;

  const mockLeader: UserDto = {
    id: 'leader-1',
    maskedPhone: '091***5678',
    fullName: 'Trưởng Khu Phố 1',
    role: UserRole.LEADER,
    status: AccountStatus.ACTIVE,
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOfficer: UserDto = {
    id: 'officer-1',
    maskedPhone: '098***1111',
    fullName: 'Cán Bộ Phường',
    role: UserRole.OFFICER,
    status: AccountStatus.ACTIVE,
    neighborhoodId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockResidentUser: UserDto = {
    id: 'res-1',
    maskedPhone: '090***2222',
    fullName: 'Cư Dân',
    role: UserRole.RESIDENT,
    status: AccountStatus.ACTIVE,
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockResidentEntity = {
    id: 'prof-1',
    fullName: 'Nguyễn Văn An',
    birthDate: new Date('1990-01-01'),
    gender: 'male',
    permanentAddress: '123 Lê Lợi',
    householdId: 'hh-1',
    neighborhoodId: 'neigh-1',
    household: {
      id: 'hh-1',
      code: 'HK-01',
      address: '123 Lê Lợi',
      neighborhoodId: 'neigh-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    neighborhood: {
      id: 'neigh-1',
      name: 'Khu phố 1',
      code: 'KP-01',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    politicalSocialProfile: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn((cb: (prisma: MockPrisma) => Promise<unknown>) =>
        cb(mockPrisma),
      ),
      residentProfile: {
        findUnique: vi.fn().mockResolvedValue(mockResidentEntity),
        findMany: vi.fn().mockResolvedValue([mockResidentEntity]),
        count: vi.fn().mockResolvedValue(1),
      },
      politicalSocialProfile: {
        upsert: vi
          .fn()
          .mockImplementation(
            ({
              create,
            }: {
              create: Record<string, unknown>;
              update: Record<string, unknown>;
            }) => ({
              id: 'psp-1',
              ...create,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
      },
    };

    service = new PoliticalSocialProfilesService(
      mockPrisma as unknown as PrismaService,
    );
  });

  describe('findAll', () => {
    it('should scope leader query to assigned neighborhood', async () => {
      const result = await service.findAll(mockLeader, {});

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.fullName).toBe('Nguyễn Văn An');
      expect(mockPrisma.residentProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            neighborhoodId: 'neigh-1',
          }),
        }),
      );
    });

    it('should allow officer to query ward-wide and filter by neighborhood', async () => {
      await service.findAll(mockOfficer, { neighborhoodId: 'neigh-2' });

      expect(mockPrisma.residentProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            neighborhoodId: 'neigh-2',
          }),
        }),
      );
    });

    it('should filter by not_updated party status', async () => {
      await service.findAll(mockOfficer, { partyStatus: 'not_updated' });

      expect(mockPrisma.residentProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            politicalSocialProfile: null,
          }),
        }),
      );
    });

    it('should filter by specific party status', async () => {
      await service.findAll(mockOfficer, {
        partyStatus: PartyStatus.PARTY_MEMBER,
      });

      expect(mockPrisma.residentProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            politicalSocialProfile: {
              partyStatus: PartyStatus.PARTY_MEMBER,
            },
          }),
        }),
      );
    });

    it('should reject resident role with 403 Forbidden', async () => {
      await expect(service.findAll(mockResidentUser, {})).rejects.toThrow(
        AppException,
      );
      try {
        await service.findAll(mockResidentUser, {});
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
          expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
        }
      }
    });
  });

  describe('findOne', () => {
    it('should return resident political item for authorized leader', async () => {
      const result = await service.findOne(mockLeader, 'prof-1');

      expect(result.id).toBe('prof-1');
      expect(result.fullName).toBe('Nguyễn Văn An');
      expect(result.householdCode).toBe('HK-01');
    });

    it('should reject leader attempting to view cross-neighborhood record with 403', async () => {
      mockPrisma.residentProfile.findUnique.mockResolvedValueOnce({
        ...mockResidentEntity,
        id: 'prof-2',
        neighborhoodId: 'neigh-2',
      });

      await expect(service.findOne(mockLeader, 'prof-2')).rejects.toThrow(
        AppException,
      );
      try {
        await service.findOne(mockLeader, 'prof-2');
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        }
      }
    });

    it('should throw 404 if resident profile not found', async () => {
      mockPrisma.residentProfile.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne(mockLeader, 'non-existent')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('upsert', () => {
    it('should successfully upsert party_member profile with valid admission date', async () => {
      const dto: UpsertPoliticalSocialProfileDto = {
        partyStatus: PartyStatus.PARTY_MEMBER,
        partyAdmissionDate: '2018-05-19T00:00:00.000Z',
        highestEducation: HighestEducation.BACHELOR,
        specialty: 'Kỹ thuật phần mềm',
        officialOccupation: 'Kỹ sư',
        strengths: 'Chuyển đổi số',
        notes: 'Ghi chú',
      };

      const result = await service.upsert(mockLeader, 'prof-1', dto);

      expect(result).toBeDefined();
      expect(result.partyStatus).toBe(PartyStatus.PARTY_MEMBER);
      expect(result.partyAdmissionDate).toBe('2018-05-19T00:00:00.000Z');
      expect(result.highestEducation).toBe(HighestEducation.BACHELOR);
      expect(mockPrisma.politicalSocialProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { residentProfileId: 'prof-1' },
          create: expect.objectContaining({
            residentProfileId: 'prof-1',
            partyStatus: PartyStatus.PARTY_MEMBER,
            highestEducation: HighestEducation.BACHELOR,
          }),
        }),
      );
    });

    it('should reject party_member without admission date with 400', async () => {
      const dto: UpsertPoliticalSocialProfileDto = {
        partyStatus: PartyStatus.PARTY_MEMBER,
        partyAdmissionDate: null,
      };

      await expect(service.upsert(mockLeader, 'prof-1', dto)).rejects.toThrow(
        AppException,
      );
    });

    it('should reject future admission date with 400', async () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 2);

      const dto: UpsertPoliticalSocialProfileDto = {
        partyStatus: PartyStatus.PARTY_MEMBER,
        partyAdmissionDate: future.toISOString(),
      };

      await expect(service.upsert(mockLeader, 'prof-1', dto)).rejects.toThrow(
        AppException,
      );
    });

    it('should reject admission date before resident birth date with 400', async () => {
      const dto: UpsertPoliticalSocialProfileDto = {
        partyStatus: PartyStatus.PARTY_MEMBER,
        partyAdmissionDate: '1980-01-01T00:00:00.000Z', // Birth date is 1990-01-01
      };

      await expect(service.upsert(mockLeader, 'prof-1', dto)).rejects.toThrow(
        AppException,
      );
    });

    it('should clear admission date to null when changing to non-party-member', async () => {
      const dto: UpsertPoliticalSocialProfileDto = {
        partyStatus: PartyStatus.NOT_MEMBER,
        partyAdmissionDate: '2020-01-01T00:00:00.000Z', // Provided stale date should be ignored
      };

      const result = await service.upsert(mockLeader, 'prof-1', dto);

      expect(result.partyStatus).toBe(PartyStatus.NOT_MEMBER);
      expect(result.partyAdmissionDate).toBeNull();
      expect(mockPrisma.politicalSocialProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            partyStatus: PartyStatus.NOT_MEMBER,
            partyAdmissionDate: null,
          }),
        }),
      );
    });

    it('should reject cross-neighborhood upsert for leader with 403 Forbidden', async () => {
      mockPrisma.residentProfile.findUnique.mockResolvedValueOnce({
        ...mockResidentEntity,
        id: 'prof-2',
        neighborhoodId: 'neigh-2',
      });

      const dto: UpsertPoliticalSocialProfileDto = {
        partyStatus: PartyStatus.NOT_MEMBER,
      };

      await expect(service.upsert(mockLeader, 'prof-2', dto)).rejects.toThrow(
        AppException,
      );
    });

    it('should reject field exceeding maximum lengths', async () => {
      const dto: UpsertPoliticalSocialProfileDto = {
        partyStatus: PartyStatus.NOT_MEMBER,
        specialty: 'a'.repeat(256),
      };

      await expect(service.upsert(mockLeader, 'prof-1', dto)).rejects.toThrow(
        AppException,
      );
    });
  });
});
