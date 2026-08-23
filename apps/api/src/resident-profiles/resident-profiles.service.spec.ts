import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import {
  AccountStatus,
  ErrorCode,
  Gender,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import { ResidentProfilesService } from './resident-profiles.service';
import { CreateResidentProfileDto } from './dto/create-resident-profile.dto';

interface MockPrisma {
  neighborhood: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  household: {
    upsert: ReturnType<typeof vi.fn>;
  };
  residentProfile: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface MockCrypto {
  encrypt: ReturnType<typeof vi.fn>;
  decrypt: ReturnType<typeof vi.fn>;
  hashCitizenId: ReturnType<typeof vi.fn>;
  hashPhone: ReturnType<typeof vi.fn>;
}

describe('ResidentProfilesService', () => {
  let service: ResidentProfilesService;
  let mockPrisma: MockPrisma;
  let mockCrypto: MockCrypto;

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

  const mockResident: UserDto = {
    id: 'res-1',
    maskedPhone: '090***2222',
    fullName: 'Cư Dân',
    role: UserRole.RESIDENT,
    status: AccountStatus.ACTIVE,
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockNeighborhood = {
    id: 'neigh-1',
    code: 'KP-01',
    name: 'Khu phố 1',
    ward: 'Phường Bến Nghé',
    district: 'Quận 1',
    city: 'TP. Hồ Chí Minh',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockCrypto = {
      encrypt: vi.fn((val: string) => `encrypted:${val}`),
      decrypt: vi.fn((val: string) => (val.startsWith('encrypted:') ? val.slice(10) : val)),
      hashCitizenId: vi.fn((val: string) => `hash_cid_${val}`),
      hashPhone: vi.fn((val: string) => `hash_phone_${val}`),
    };

    mockPrisma = {
      $transaction: vi.fn((cb: (prisma: MockPrisma) => Promise<unknown>) => cb(mockPrisma)),
      neighborhood: {
        findUnique: vi.fn().mockResolvedValue(mockNeighborhood),
      },
      household: {
        upsert: vi.fn().mockImplementation(({ create }: { create: { code: string; neighborhoodId: string; address: string } }) => ({
          id: 'hh-new-1',
          code: create.code,
          neighborhoodId: create.neighborhoodId,
          address: create.address,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      residentProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: 'prof-new-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          household: {
            id: data.householdId,
            code: 'HK-001',
            neighborhoodId: data.neighborhoodId,
            address: data.permanentAddress,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          neighborhood: mockNeighborhood,
        })),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
      },
    };

    service = new ResidentProfilesService(
      mockPrisma as unknown as PrismaService,
      mockCrypto as unknown as CryptoService,
    );
  });

  describe('create', () => {
    const validDto: CreateResidentProfileDto = {
      fullName: 'Nguyễn Văn Test',
      citizenId: '012345678901',
      birthDate: '1990-01-01T00:00:00.000Z',
      gender: Gender.MALE,
      permanentAddress: '123 Lê Lợi',
      householdCode: 'HK-001',
      phoneNumber: '0901234567',
      email: 'test@example.com',
    };

    it('should allow leader to create profile in their assigned neighborhood', async () => {
      const result = await service.create(mockLeader, validDto);

      expect(result).toBeDefined();
      expect(result.fullName).toBe('Nguyễn Văn Test');
      expect(result.citizenId).toBe('012345678901');
      expect(result.maskedCitizenId).toBe('012******901');
      expect(result.neighborhoodId).toBe('neigh-1');
      expect(mockCrypto.encrypt).toHaveBeenCalledWith('012345678901');
      expect(mockCrypto.hashCitizenId).toHaveBeenCalledWith('012345678901');
      expect(mockPrisma.household.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            neighborhoodId_code: {
              neighborhoodId: 'neigh-1',
              code: 'HK-001',
            },
          },
        }),
      );
    });

    it('should allow officer to create profile with specified neighborhoodId', async () => {
      const officerDto: CreateResidentProfileDto = {
        ...validDto,
        neighborhoodId: 'neigh-1',
      };
      const result = await service.create(mockOfficer, officerDto);

      expect(result).toBeDefined();
      expect(result.neighborhoodId).toBe('neigh-1');
    });

    it('should reject resident role with 403', async () => {
      await expect(service.create(mockResident, validDto)).rejects.toThrow(
        AppException,
      );
      try {
        await service.create(mockResident, validDto);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
          expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
        }
      }
    });

    it('should reject duplicate citizen ID with 409 conflict', async () => {
      mockPrisma.residentProfile.findUnique.mockResolvedValueOnce({
        id: 'existing-id',
        citizenIdHash: 'hash_cid_012345678901',
      });

      await expect(service.create(mockLeader, validDto)).rejects.toThrow(
        AppException,
      );
      try {
        await service.create(mockLeader, validDto);
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
          expect(err.errorCode).toBe(ErrorCode.CITIZEN_ID_ALREADY_EXISTS);
        }
      }
    });

    it('should reject invalid citizen ID length', async () => {
      const invalidCidDto = { ...validDto, citizenId: '123' };
      await expect(service.create(mockLeader, invalidCidDto)).rejects.toThrow(
        AppException,
      );
    });

    it('should reject future birth date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const invalidDateDto = { ...validDto, birthDate: futureDate.toISOString() };

      await expect(service.create(mockLeader, invalidDateDto)).rejects.toThrow(
        AppException,
      );
    });

    it('should reuse existing household when (neighborhoodId, code) matches', async () => {
      const existingHousehold = {
        id: 'hh-existing-1',
        code: 'HK-001',
        neighborhoodId: 'neigh-1',
        address: '123 Lê Lợi',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.household.upsert.mockResolvedValueOnce(existingHousehold);

      await service.create(mockLeader, validDto);

      expect(mockPrisma.household.upsert).toHaveBeenCalledOnce();
      expect(mockPrisma.residentProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            householdId: 'hh-existing-1',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should scope leader query strictly to leader neighborhood', async () => {
      mockPrisma.residentProfile.findMany.mockResolvedValueOnce([]);
      mockPrisma.residentProfile.count.mockResolvedValueOnce(0);

      const result = await service.findAll(mockLeader, { page: 1, limit: 10 });

      expect(result.items).toEqual([]);
      expect(mockPrisma.residentProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            neighborhoodId: 'neigh-1',
          }),
        }),
      );
    });

    it('should allow officer to search with exact 12-digit citizen ID via HMAC hash', async () => {
      mockPrisma.residentProfile.findMany.mockResolvedValueOnce([]);
      mockPrisma.residentProfile.count.mockResolvedValueOnce(0);

      await service.findAll(mockOfficer, { search: '012345678901' });

      expect(mockCrypto.hashCitizenId).toHaveBeenCalledWith('012345678901');
      expect(mockPrisma.residentProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { citizenIdHash: 'hash_cid_012345678901' },
            ]),
          }),
        }),
      );
    });

    it('should reject resident role with 403', async () => {
      await expect(service.findAll(mockResident, {})).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('findOne', () => {
    it('should return decrypted citizen ID for authorized leader in same neighborhood', async () => {
      mockPrisma.residentProfile.findUnique.mockResolvedValue({
        id: 'prof-1',
        fullName: 'Nguyễn Văn A',
        citizenIdEncrypted: 'encrypted:012345678901',
        citizenIdHash: 'hash_cid_012345678901',
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        permanentAddress: '123 Lê Lợi',
        householdId: 'hh-1',
        neighborhoodId: 'neigh-1',
        household: { id: 'hh-1', code: 'HK-01', address: '123 Lê Lợi', createdAt: new Date(), updatedAt: new Date() },
        neighborhood: mockNeighborhood,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findOne(mockLeader, 'prof-1');

      expect(result.citizenId).toBe('012345678901');
      expect(result.maskedCitizenId).toBe('012******901');
      expect(result.fullName).toBe('Nguyễn Văn A');
    });

    it('should reject leader attempting to view profile from another neighborhood with 403', async () => {
      mockPrisma.residentProfile.findUnique.mockResolvedValueOnce({
        id: 'prof-2',
        fullName: 'Người khác khu phố',
        citizenIdEncrypted: 'encrypted:012345678902',
        citizenIdHash: 'hash_cid_012345678902',
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        permanentAddress: '456 Hai Bà Trưng',
        householdId: 'hh-2',
        neighborhoodId: 'neigh-2',
        household: null,
        neighborhood: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      try {
        await service.findOne(mockLeader, 'prof-2');
        expect.fail('Expected cross-neighborhood access to be rejected');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('should throw 404 if profile does not exist', async () => {
      mockPrisma.residentProfile.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne(mockOfficer, 'non-existent')).rejects.toThrow(
        AppException,
      );
      try {
        await service.findOne(mockOfficer, 'non-existent');
      } catch (err: unknown) {
        if (err instanceof AppException) {
          expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
          expect(err.errorCode).toBe(ErrorCode.RESIDENT_PROFILE_NOT_FOUND);
        }
      }
    });
  });
});
