import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Readable } from 'stream';
import {
  AccountStatus,
  PetitionCategory,
  PetitionStatus,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import {
  PetitionCategory as DbPetitionCategory,
  PetitionStatus as DbPetitionStatus,
  Role,
} from '@prisma/client';
import { PetitionsService } from './petitions.service';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CryptoService } from '../security/crypto.service';
import { PetitionEvidenceStorageService } from './petition-evidence-storage.service';

interface MockPrisma {
  petition: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  petitionEvidence: {
    findFirst: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  petitionHistory: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  account: {
    findMany: ReturnType<typeof vi.fn>;
  };
  notification: {
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface MockNotificationsService {
  createNotification: ReturnType<typeof vi.fn>;
  createBatchNotifications: ReturnType<typeof vi.fn>;
  sendPushNotifications: ReturnType<typeof vi.fn>;
}

interface MockStorageService {
  saveEvidence: ReturnType<typeof vi.fn>;
  cleanupFiles: ReturnType<typeof vi.fn>;
  resolveEvidencePath: ReturnType<typeof vi.fn>;
}

interface MockCryptoService {
  encrypt: ReturnType<typeof vi.fn>;
  decrypt: ReturnType<typeof vi.fn>;
  hashPhone: ReturnType<typeof vi.fn>;
}

function createMockMulterFile(
  originalname: string,
  mimetype: string,
  buffer: Buffer,
): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: null as unknown as Readable,
  };
}

describe('PetitionsService', () => {
  let service: PetitionsService;
  let prismaMock: MockPrisma;
  let notificationsServiceMock: MockNotificationsService;
  let storageServiceMock: MockStorageService;
  let cryptoServiceMock: MockCryptoService;

  const residentUser: UserDto = {
    id: 'resident-1',
    maskedPhone: '090***1111',
    fullName: 'Nguyen Van Cư Dân',
    role: UserRole.RESIDENT,
    status: AccountStatus.ACTIVE,
    address: '123 Pho Hue',
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const otherResidentUser: UserDto = {
    id: 'resident-2',
    maskedPhone: '090***2222',
    fullName: 'Le Van Resident 2',
    role: UserRole.RESIDENT,
    status: AccountStatus.ACTIVE,
    address: '127 Pho Hue',
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const leaderUser: UserDto = {
    id: 'leader-1',
    maskedPhone: '090***3333',
    fullName: 'Tran Van Trưởng KP',
    role: UserRole.LEADER,
    status: AccountStatus.ACTIVE,
    address: '125 Pho Hue',
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const otherLeaderUser: UserDto = {
    id: 'leader-2',
    maskedPhone: '090***4444',
    fullName: 'Hoang Van Trưởng KP 2',
    role: UserRole.LEADER,
    status: AccountStatus.ACTIVE,
    address: '50 Hang Bai',
    neighborhoodId: 'neigh-2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const officerUser: UserDto = {
    id: 'officer-1',
    maskedPhone: '090***5555',
    fullName: 'Pham Van Cán Bộ',
    role: UserRole.OFFICER,
    status: AccountStatus.ACTIVE,
    address: null,
    neighborhoodId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    prismaMock = {
      petition: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      petitionEvidence: {
        findFirst: vi.fn(),
        createMany: vi.fn(),
      },
      petitionHistory: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      account: {
        findMany: vi.fn(),
      },
      notification: {
        create: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (tx: MockPrisma) => Promise<unknown>) =>
        callback(prismaMock),
      ),
    };

    notificationsServiceMock = {
      createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      createBatchNotifications: vi.fn().mockResolvedValue(2),
      sendPushNotifications: vi.fn().mockResolvedValue(undefined),
    };

    storageServiceMock = {
      saveEvidence: vi.fn().mockResolvedValue({
        fileName: 'uuid.jpg',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        filePath: '/uploads/petitions/uuid.jpg',
      }),
      cleanupFiles: vi.fn().mockResolvedValue(undefined),
      resolveEvidencePath: vi.fn().mockResolvedValue('/uploads/petitions/uuid.jpg'),
    };

    cryptoServiceMock = {
      encrypt: vi.fn((val: string) => `enc_${val}`),
      decrypt: vi.fn((val: string) => val.replace('enc_', '')),
      hashPhone: vi.fn((val: string) => `hash_${val}`),
    };

    service = new PetitionsService(
      prismaMock as unknown as PrismaService,
      notificationsServiceMock as unknown as NotificationsService,
      storageServiceMock as unknown as PetitionEvidenceStorageService,
      cryptoServiceMock as unknown as CryptoService,
    );
  });

  describe('Creation (FR-12)', () => {
    it('should forbid leader or officer from creating a petition (resident-only)', async () => {
      await expect(
        service.create(leaderUser, {
          title: 'Title',
          description: 'Desc',
          category: PetitionCategory.INFRASTRUCTURE,
        }),
      ).rejects.toThrowError(AppException);

      await expect(
        service.create(officerUser, {
          title: 'Title',
          description: 'Desc',
          category: PetitionCategory.INFRASTRUCTURE,
        }),
      ).rejects.toThrowError(AppException);
    });

    it('should create petition in reviewing state and notify active neighborhood leaders', async () => {
      const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const validFile = createMockMulterFile('pothole.jpg', 'image/jpeg', jpgBuffer);

      const createdPet = {
        id: 'pet-1',
        title: 'Đường hỏng trước số nhà 12',
        description: 'Ổ gà lớn gây nguy hiểm cho người tham gia giao thông',
        category: DbPetitionCategory.infrastructure,
        status: DbPetitionStatus.reviewing,
        neighborhoodId: 'neigh-1',
        authorId: residentUser.id,
        responseNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: { id: 'neigh-1', name: 'Khu phố 1', code: 'KP1', ward: 'Phường 1', district: 'Q1', city: 'HCM', createdAt: new Date(), updatedAt: new Date() },
        author: { id: residentUser.id, fullName: residentUser.fullName, role: Role.resident, phoneEncrypted: 'enc_0901111111', address: '123 Pho Hue' },
        evidence: [],
        histories: [],
      };

      prismaMock.petition.create.mockResolvedValue(createdPet);
      prismaMock.petition.findUnique.mockResolvedValue(createdPet);
      prismaMock.account.findMany.mockResolvedValue([{ id: 'leader-1' }]);

      const result = await service.create(
        residentUser,
        {
          title: 'Đường hỏng trước số nhà 12',
          description: 'Ổ gà lớn gây nguy hiểm cho người tham gia giao thông',
          category: PetitionCategory.INFRASTRUCTURE,
        },
        [validFile],
      );

      expect(result.id).toBe('pet-1');
      expect(result.status).toBe(PetitionStatus.REVIEWING);
      expect(storageServiceMock.saveEvidence).toHaveBeenCalled();
      expect(prismaMock.petitionEvidence.createMany).toHaveBeenCalled();
      expect(prismaMock.petitionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromStatus: null,
          toStatus: DbPetitionStatus.reviewing,
          changedById: residentUser.id,
        }),
      });
      expect(prismaMock.notification.createMany).toHaveBeenCalled();
    });

    it('should clean up staged files on disk if DB transaction fails', async () => {
      const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const validFile = createMockMulterFile('pothole.jpg', 'image/jpeg', jpgBuffer);

      prismaMock.$transaction.mockRejectedValue(new Error('DB failure'));

      await expect(
        service.create(
          residentUser,
          {
            title: 'Đường hỏng',
            description: 'Mô tả',
            category: PetitionCategory.INFRASTRUCTURE,
          },
          [validFile],
        ),
      ).rejects.toThrowError('DB failure');

      expect(storageServiceMock.cleanupFiles).toHaveBeenCalled();
    });

    it('should reject whitespace-only title or description with AppException', async () => {
      await expect(
        service.create(residentUser, {
          title: '   ',
          description: 'Valid description',
          category: PetitionCategory.INFRASTRUCTURE,
        }),
      ).rejects.toThrowError(AppException);

      await expect(
        service.create(residentUser, {
          title: 'Valid title',
          description: '   ',
          category: PetitionCategory.INFRASTRUCTURE,
        }),
      ).rejects.toThrowError(AppException);
    });
  });

  describe('Scoping & List Query (FR-13 & FR-14)', () => {
    it('should reject when startDate is after endDate with AppException', async () => {
      await expect(
        service.findAll(residentUser, {
          startDate: '2026-08-25',
          endDate: '2026-08-20',
        }),
      ).rejects.toThrowError(AppException);
    });

    it('should restrict resident to only their own petitions', async () => {
      prismaMock.petition.findMany.mockResolvedValue([]);
      prismaMock.petition.count.mockResolvedValue(0);

      await service.findAll(residentUser, {});

      expect(prismaMock.petition.findMany).toHaveBeenCalled();
      const whereArg = (prismaMock.petition.findMany.mock.calls[0]?.[0] as { where: { AND: Array<{ authorId?: string }> } }).where;
      expect(whereArg.AND).toEqual(
        expect.arrayContaining([{ authorId: residentUser.id }]),
      );
    });

    it('should restrict leader to only assigned neighborhood petitions', async () => {
      prismaMock.petition.findMany.mockResolvedValue([]);
      prismaMock.petition.count.mockResolvedValue(0);

      await service.findAll(leaderUser, {});

      expect(prismaMock.petition.findMany).toHaveBeenCalled();
      const whereArg = (prismaMock.petition.findMany.mock.calls[0]?.[0] as { where: { AND: Array<{ neighborhoodId?: string }> } }).where;
      expect(whereArg.AND).toEqual(
        expect.arrayContaining([{ neighborhoodId: leaderUser.neighborhoodId }]),
      );
    });

    it('should allow officer to query ward-wide or filter by specific neighborhood', async () => {
      prismaMock.petition.findMany.mockResolvedValue([]);
      prismaMock.petition.count.mockResolvedValue(0);

      await service.findAll(officerUser, { neighborhoodId: 'neigh-2' });

      expect(prismaMock.petition.findMany).toHaveBeenCalled();
      const whereArg = (prismaMock.petition.findMany.mock.calls[0]?.[0] as { where: { AND: Array<{ neighborhoodId?: string }> } }).where;
      expect(whereArg.AND).toEqual(
        expect.arrayContaining([{ neighborhoodId: 'neigh-2' }]),
      );
    });
  });

  describe('Detail & Scoping (FR-13)', () => {
    it('should forbid resident from viewing another resident petition (404 NOT FOUND)', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-other',
        authorId: otherResidentUser.id,
        neighborhoodId: 'neigh-1',
      });

      await expect(service.findOne(residentUser, 'pet-other')).rejects.toThrowError(
        AppException,
      );
    });

    it('should forbid leader from viewing another neighborhood petition (404 NOT FOUND)', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-other-neighborhood',
        authorId: residentUser.id,
        neighborhoodId: 'neigh-2',
      });

      await expect(service.findOne(leaderUser, 'pet-other-neighborhood')).rejects.toThrowError(
        AppException,
      );
    });
  });

  describe('State Machine & Transitions (FR-15)', () => {
    it('should allow leader to transition from reviewing to processing', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-1',
        title: 'Kiến nghị 1',
        description: 'Mô tả kiến nghị 1',
        category: DbPetitionCategory.infrastructure,
        status: DbPetitionStatus.reviewing,
        neighborhoodId: 'neigh-1',
        neighborhood: null,
        authorId: residentUser.id,
        author: { id: residentUser.id, fullName: 'Cư dân A', role: Role.resident },
        evidence: [],
        histories: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prismaMock.petition.updateMany.mockResolvedValue({ count: 1 });

      await service.updateStatus(leaderUser, 'pet-1', {
        status: PetitionStatus.PROCESSING,
        responseNote: 'Đã phân công cán bộ khảo sát',
      });

      expect(prismaMock.petition.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'pet-1',
          status: DbPetitionStatus.reviewing,
          neighborhoodId: leaderUser.neighborhoodId,
        },
        data: {
          status: DbPetitionStatus.processing,
          responseNote: 'Đã phân công cán bộ khảo sát',
        },
      });

      expect(prismaMock.petitionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          petitionId: 'pet-1',
          fromStatus: DbPetitionStatus.reviewing,
          toStatus: DbPetitionStatus.processing,
          changedById: leaderUser.id,
        }),
      });

      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: residentUser.id,
          referenceId: 'pet-1',
        }),
      });
    });

    it('should forbid leader from transitioning petition in another neighborhood', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-1',
        title: 'Kiến nghị 1',
        status: DbPetitionStatus.reviewing,
        neighborhoodId: 'neigh-1',
        authorId: residentUser.id,
      });

      await expect(
        service.updateStatus(otherLeaderUser, 'pet-1', {
          status: PetitionStatus.PROCESSING,
        }),
      ).rejects.toThrowError(AppException);
    });

    it('should require a nonblank response note when rejecting a petition', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-1',
        status: DbPetitionStatus.processing,
        neighborhoodId: 'neigh-1',
        authorId: residentUser.id,
      });

      await expect(
        service.updateStatus(leaderUser, 'pet-1', {
          status: PetitionStatus.REJECTED,
          responseNote: '   ',
        }),
      ).rejects.toThrowError(AppException);
    });

    it('should reject invalid transition e.g. reviewing directly to resolved or rejected', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-1',
        status: DbPetitionStatus.reviewing,
        neighborhoodId: 'neigh-1',
        authorId: residentUser.id,
      });

      await expect(
        service.updateStatus(leaderUser, 'pet-1', {
          status: PetitionStatus.RESOLVED,
        }),
      ).rejects.toThrowError(AppException);

      await expect(
        service.updateStatus(leaderUser, 'pet-1', {
          status: PetitionStatus.REJECTED,
          responseNote: 'Reason',
        }),
      ).rejects.toThrowError(AppException);
    });

    it('should handle concurrency conflict if status changed concurrently', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-1',
        status: DbPetitionStatus.reviewing,
        neighborhoodId: 'neigh-1',
        authorId: residentUser.id,
      });

      prismaMock.petition.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus(leaderUser, 'pet-1', {
          status: PetitionStatus.PROCESSING,
        }),
      ).rejects.toThrowError(AppException);
    });
  });

  describe('Resident Cancellation (FR-16)', () => {
    it('should allow author to cancel petition while in reviewing status', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-1',
        title: 'Kiến nghị 1',
        description: 'Mô tả kiến nghị',
        category: DbPetitionCategory.infrastructure,
        status: DbPetitionStatus.reviewing,
        neighborhoodId: 'neigh-1',
        neighborhood: null,
        authorId: residentUser.id,
        author: { id: residentUser.id, fullName: 'Cư dân A', role: Role.resident },
        evidence: [],
        histories: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prismaMock.petition.updateMany.mockResolvedValue({ count: 1 });

      await service.cancel(residentUser, 'pet-1', {
        reason: 'Đã tự giải quyết được vấn đề',
      });

      expect(prismaMock.petition.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'pet-1',
          authorId: residentUser.id,
          status: DbPetitionStatus.reviewing,
        },
        data: {
          status: DbPetitionStatus.cancelled,
          responseNote: 'Đã tự giải quyết được vấn đề',
        },
      });

      expect(prismaMock.petitionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromStatus: DbPetitionStatus.reviewing,
          toStatus: DbPetitionStatus.cancelled,
          changedById: residentUser.id,
        }),
      });
    });

    it('should forbid cancelling a petition that has moved to processing, resolved, or rejected', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-1',
        status: DbPetitionStatus.processing,
        authorId: residentUser.id,
      });

      await expect(service.cancel(residentUser, 'pet-1')).rejects.toThrowError(
        AppException,
      );
    });

    it('should forbid non-author from cancelling petition', async () => {
      prismaMock.petition.findUnique.mockResolvedValue({
        id: 'pet-1',
        status: DbPetitionStatus.reviewing,
        authorId: otherResidentUser.id,
      });

      await expect(service.cancel(residentUser, 'pet-1')).rejects.toThrowError(
        AppException,
      );
    });
  });
});
