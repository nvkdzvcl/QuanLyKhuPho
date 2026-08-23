import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
  AccountStatus,
  ErrorCode,
  ExportDataset,
  ExportFormat,
  Gender,
  HighestEducation,
  PartyStatus,
  PetitionCategory,
  PetitionStatus,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import { ExportsService } from './exports.service';

interface MockPrisma {
  residentProfile: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  neighborhoodActivity: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  petition: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
}

interface MockCrypto {
  encrypt: ReturnType<typeof vi.fn>;
  decrypt: ReturnType<typeof vi.fn>;
  hashCitizenId: ReturnType<typeof vi.fn>;
  hashPhone: ReturnType<typeof vi.fn>;
}

describe('ExportsService', () => {
  let service: ExportsService;
  let mockPrisma: MockPrisma;
  let mockCrypto: MockCrypto;

  const mockLeader: UserDto = {
    id: 'leader-1',
    maskedPhone: '091***5678',
    fullName: 'Trưởng Khu Phố',
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

  let mockResponse: {
    headers: Record<string, string>;
    sentBody: unknown;
    setHeader: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCrypto = {
      encrypt: vi.fn((val: string) => `encrypted:${val}`),
      decrypt: vi.fn((val: string) => (val.startsWith('encrypted:') ? val.slice(10) : val)),
      hashCitizenId: vi.fn((val: string) => `hash_cid_${val}`),
      hashPhone: vi.fn((val: string) => `hash_phone_${val}`),
    };

    mockPrisma = {
      residentProfile: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      neighborhoodActivity: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      petition: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    mockResponse = {
      headers: {},
      sentBody: null,
      setHeader: vi.fn((key: string, val: string) => {
        mockResponse.headers[key] = val;
      }),
      send: vi.fn((body: unknown) => {
        mockResponse.sentBody = body;
      }),
    };

    service = new ExportsService(
      mockPrisma as unknown as PrismaService,
      mockCrypto as unknown as CryptoService,
    );
  });

  describe('Authorization & Scoping', () => {
    it('should reject resident role with 403 Forbidden', async () => {
      await expect(
        service.exportData(
          mockResident,
          ExportDataset.RESIDENTS,
          {},
          mockResponse as unknown as Response,
        ),
      ).rejects.toThrow(AppException);
    });

    it('should reject invalid export dataset with 400 Bad Request', async () => {
      await expect(
        service.exportData(
          mockOfficer,
          'invalid_dataset' as ExportDataset,
          {},
          mockResponse as unknown as Response,
        ),
      ).rejects.toThrow(AppException);
    });

    it('should enforce leader neighborhood scoping', async () => {
      mockPrisma.residentProfile.count.mockResolvedValueOnce(0);
      mockPrisma.residentProfile.findMany.mockResolvedValueOnce([]);

      await service.exportData(
        mockLeader,
        ExportDataset.RESIDENTS,
        { neighborhoodId: 'foreign-neigh' },
        mockResponse as unknown as Response,
      );

      expect(mockPrisma.residentProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            neighborhoodId: 'neigh-1',
          }),
        }),
      );
    });
  });

  describe('Row limit enforcement (max 10,000)', () => {
    it('should reject export when matching rows exceed 10,000', async () => {
      mockPrisma.residentProfile.count.mockResolvedValueOnce(10001);

      await expect(
        service.exportData(
          mockOfficer,
          ExportDataset.RESIDENTS,
          {},
          mockResponse as unknown as Response,
        ),
      ).rejects.toThrow(AppException);

      try {
        await service.exportData(
          mockOfficer,
          ExportDataset.RESIDENTS,
          {},
          mockResponse as unknown as Response,
        );
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect((err as AppException).errorCode).toBe(ErrorCode.EXPORT_LIMIT_EXCEEDED);
      }
    });
  });

  describe('Resident Profiles Export (CSV & XLSX)', () => {
    const sampleResident = {
      id: 'prof-1',
      fullName: 'Nguyễn Văn An',
      citizenIdEncrypted: 'encrypted:012345678901',
      phoneEncrypted: 'encrypted:0901234567',
      emailEncrypted: 'encrypted:an@example.com',
      birthDate: new Date('1990-05-15T00:00:00.000Z'),
      gender: Gender.MALE,
      relationshipToHead: 'Chủ hộ',
      occupation: '=SUM(1,2)', // Formula injection test candidate
      permanentAddress: '123 Lê Lợi',
      currentAddress: '123 Lê Lợi',
      ward: 'Phường Bến Nghé',
      household: { code: 'HK-001' },
      neighborhood: { name: 'Khu phố 1', ward: 'Phường Bến Nghé' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    it('should export residents in UTF-8 CSV with BOM, masking, and formula protection', async () => {
      mockPrisma.residentProfile.count.mockResolvedValueOnce(1);
      mockPrisma.residentProfile.findMany.mockResolvedValueOnce([sampleResident]);

      await service.exportData(
        mockLeader,
        ExportDataset.RESIDENTS,
        { format: ExportFormat.CSV },
        mockResponse as unknown as Response,
      );

      expect(mockResponse.headers['Content-Type']).toBe('text/csv; charset=utf-8');
      expect(mockResponse.headers['Cache-Control']).toContain('no-store');
      expect(mockResponse.headers['Content-Disposition']).toContain('danh-sach-nhan-khau-');

      const csv = mockResponse.sentBody as string;
      expect(csv.startsWith('\uFEFF')).toBe(true); // UTF-8 BOM
      expect(csv).toContain('Nguyễn Văn An');
      expect(csv).toContain('012******901'); // Masked citizen ID
      expect(csv).not.toContain('012345678901'); // Plaintext citizen ID must NOT be present
      expect(csv).toContain("'=SUM(1,2)"); // Formula injection escaped with leading quote
    });

    it('should export residents in XLSX format as Buffer', async () => {
      mockPrisma.residentProfile.count.mockResolvedValueOnce(1);
      mockPrisma.residentProfile.findMany.mockResolvedValueOnce([sampleResident]);

      await service.exportData(
        mockLeader,
        ExportDataset.RESIDENTS,
        { format: ExportFormat.XLSX },
        mockResponse as unknown as Response,
      );

      expect(mockResponse.headers['Content-Type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(mockResponse.headers['Content-Disposition']).toContain('.xlsx');
      expect(Buffer.isBuffer(mockResponse.sentBody)).toBe(true);
    });
  });

  describe('Political-Social Profiles Export', () => {
    it('should export political-social profiles with mapped status and education', async () => {
      mockPrisma.residentProfile.count.mockResolvedValueOnce(1);
      mockPrisma.residentProfile.findMany.mockResolvedValueOnce([
        {
          id: 'prof-2',
          fullName: 'Trần Thị Bình',
          gender: Gender.FEMALE,
          birthDate: new Date('1985-08-20T00:00:00.000Z'),
          household: { code: 'HK-002' },
          neighborhood: { name: 'Khu phố 2' },
          politicalSocialProfile: {
            partyStatus: PartyStatus.PARTY_MEMBER,
            partyAdmissionDate: new Date('2015-02-03T00:00:00.000Z'),
            highestEducation: HighestEducation.BACHELOR,
            specialty: 'Công nghệ thông tin',
            officialOccupation: 'Kỹ sư phần mềm',
            strengths: 'Quản lý dự án',
            notes: 'Tích cực',
          },
        },
      ]);

      await service.exportData(
        mockOfficer,
        ExportDataset.POLITICAL_SOCIAL,
        { format: ExportFormat.CSV },
        mockResponse as unknown as Response,
      );

      const csv = mockResponse.sentBody as string;
      expect(csv).toContain('Trần Thị Bình');
      expect(csv).toContain('Đảng viên');
      expect(csv).toContain('Đại học / Cử nhân');
      expect(csv).toContain('Kỹ sư phần mềm');
    });
  });

  describe('Activities Export', () => {
    it('should export activities with attendance counts and rates', async () => {
      mockPrisma.neighborhoodActivity.count.mockResolvedValueOnce(1);
      mockPrisma.neighborhoodActivity.findMany.mockResolvedValueOnce([
        {
          id: 'act-1',
          name: 'Họp dân phố tháng 8',
          activityDate: new Date('2026-08-15T00:00:00.000Z'),
          filterCondition: 'all',
          personInCharge: 'Nguyễn Văn A',
          description: 'Họp định kỳ',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          neighborhood: { name: 'Khu phố 1' },
          createdBy: { fullName: 'Trưởng Khu Phố' },
          participants: [
            { attendance: 'attended' },
            { attendance: 'attended' },
            { attendance: 'absent' },
            { attendance: 'unconfirmed' },
          ],
        },
      ]);

      await service.exportData(
        mockLeader,
        ExportDataset.ACTIVITIES,
        { format: ExportFormat.CSV, month: '2026-08' },
        mockResponse as unknown as Response,
      );

      const csv = mockResponse.sentBody as string;
      expect(csv).toContain('Họp dân phố tháng 8');
      expect(csv).toContain('50%'); // 2/4 attended = 50%
      expect(mockResponse.headers['Content-Disposition']).toContain('so-tay-hoat-dong-2026-08.csv');
    });
  });

  describe('Petitions Export', () => {
    it('should export petitions with category, status, and masked phone', async () => {
      mockPrisma.petition.count.mockResolvedValueOnce(1);
      mockPrisma.petition.findMany.mockResolvedValueOnce([
        {
          id: 'pet-1',
          title: 'Sửa chữa đèn đường ngõ 12',
          category: PetitionCategory.INFRASTRUCTURE,
          status: PetitionStatus.PROCESSING,
          description: 'Đèn đường bị hỏng',
          responseNote: 'Đang cử thợ sửa',
          createdAt: new Date('2026-08-10T10:00:00.000Z'),
          updatedAt: new Date('2026-08-11T15:00:00.000Z'),
          neighborhood: { name: 'Khu phố 1' },
          author: { fullName: 'Lê Văn Cư Dân', phoneEncrypted: 'encrypted:0912345678' },
        },
      ]);

      await service.exportData(
        mockLeader,
        ExportDataset.PETITIONS,
        { format: ExportFormat.CSV },
        mockResponse as unknown as Response,
      );

      const csv = mockResponse.sentBody as string;
      expect(csv).toContain('Sửa chữa đèn đường ngõ 12');
      expect(csv).toContain('Cơ sở hạ tầng');
      expect(csv).toContain('Đang xử lý');
      expect(csv).toContain('091***5678'); // Masked author phone
      expect(csv).not.toContain('0912345678');
    });
  });
});
