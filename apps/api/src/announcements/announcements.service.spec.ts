import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Readable } from 'stream';
import {
  AccountStatus,
  AnnouncementScope,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import {
  AnnouncementScope as DbAnnouncementScope,
  AnnouncementStatus as DbAnnouncementStatus,
  Role,
} from '@prisma/client';
import { AnnouncementsService } from './announcements.service';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AttachmentStorageService } from './attachment-storage.service';

interface MockPrisma {
  announcement: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  attachment: {
    findFirst: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  comment: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  account: {
    findMany: ReturnType<typeof vi.fn>;
  };
  neighborhood: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

interface MockNotificationsService {
  createNotification: ReturnType<typeof vi.fn>;
  createBatchNotifications: ReturnType<typeof vi.fn>;
  sendPushNotifications: ReturnType<typeof vi.fn>;
}

interface MockStorageService {
  saveAttachment: ReturnType<typeof vi.fn>;
  cleanupFiles: ReturnType<typeof vi.fn>;
  resolveAttachmentPath: ReturnType<typeof vi.fn>;
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

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prismaMock: MockPrisma;
  let notificationsServiceMock: MockNotificationsService;
  let storageServiceMock: MockStorageService;

  const residentUser: UserDto = {
    id: 'resident-1',
    maskedPhone: '090***1111',
    fullName: 'Nguyen Van A',
    role: UserRole.RESIDENT,
    status: AccountStatus.ACTIVE,
    address: '123 Pho Hue',
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const leaderUser: UserDto = {
    id: 'leader-1',
    maskedPhone: '090***2222',
    fullName: 'Tran Van Leader',
    role: UserRole.LEADER,
    status: AccountStatus.ACTIVE,
    address: '125 Pho Hue',
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const otherLeaderUser: UserDto = {
    id: 'leader-2',
    maskedPhone: '090***3333',
    fullName: 'Le Van Leader 2',
    role: UserRole.LEADER,
    status: AccountStatus.ACTIVE,
    address: '50 Hang Bai',
    neighborhoodId: 'neigh-2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const officerUser: UserDto = {
    id: 'officer-1',
    maskedPhone: '090***4444',
    fullName: 'Pham Van Officer',
    role: UserRole.OFFICER,
    status: AccountStatus.ACTIVE,
    address: null,
    neighborhoodId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    prismaMock = {
      announcement: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      attachment: {
        findFirst: vi.fn(),
        createMany: vi.fn(),
      },
      comment: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      account: {
        findMany: vi.fn(),
      },
      neighborhood: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (tx: MockPrisma) => Promise<unknown>) => callback(prismaMock)),
    };

    notificationsServiceMock = {
      createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      createBatchNotifications: vi.fn().mockResolvedValue(5),
      sendPushNotifications: vi.fn().mockResolvedValue(undefined),
    };

    storageServiceMock = {
      saveAttachment: vi.fn().mockResolvedValue({
        fileName: 'uuid.pdf',
        originalName: 'report.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        filePath: '/uploads/uuid.pdf',
      }),
      cleanupFiles: vi.fn().mockResolvedValue(undefined),
      resolveAttachmentPath: vi.fn().mockResolvedValue('/uploads/uuid.pdf'),
    };

    service = new AnnouncementsService(
      prismaMock as unknown as PrismaService,
      notificationsServiceMock as unknown as NotificationsService,
      storageServiceMock as unknown as AttachmentStorageService,
    );
  });

  describe('Feed Scoping & Visibility', () => {
    it('should restrict resident feed to ward-wide and their own neighborhood', async () => {
      prismaMock.announcement.findMany.mockResolvedValue([]);
      prismaMock.announcement.count.mockResolvedValue(0);

      await service.getFeed(residentUser, {});

      expect(prismaMock.announcement.findMany).toHaveBeenCalled();
      const whereArg = (prismaMock.announcement.findMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } }).where;
      expect(whereArg.AND).toBeDefined();
    });

    it('should deny resident attempting to filter by another neighborhood', async () => {
      await expect(
        service.getFeed(residentUser, { neighborhoodId: 'neigh-2' }),
      ).rejects.toThrowError(AppException);
    });

    it('should allow officer to query any neighborhood or all', async () => {
      prismaMock.announcement.findMany.mockResolvedValue([]);
      prismaMock.announcement.count.mockResolvedValue(0);

      const res = await service.getFeed(officerUser, {
        neighborhoodId: 'neigh-2',
      });
      expect(res.items).toEqual([]);
    });
  });

  describe('Creation Authorization & Scoping', () => {
    it('should reject announcement creation by a resident (403 FORBIDDEN)', async () => {
      await expect(
        service.create(residentUser, {
          title: 'Test',
          content: 'Test content',
          scope: AnnouncementScope.NEIGHBORHOOD,
        }),
      ).rejects.toThrowError(AppException);
    });

    it('should forbid a leader from targeting ward scope', async () => {
      await expect(
        service.create(leaderUser, {
          title: 'Test',
          content: 'Test content',
          scope: AnnouncementScope.WARD,
        }),
      ).rejects.toThrowError(AppException);
    });

    it('should allow leader to create neighborhood announcement and notify active residents in scope', async () => {
      const createdAnn = {
        id: 'ann-1',
        title: 'Hop to dan pho',
        content: 'Noi dung hop to dan pho',
        scope: DbAnnouncementScope.neighborhood,
        status: DbAnnouncementStatus.published,
        neighborhoodId: 'neigh-1',
        authorId: leaderUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: { id: 'neigh-1', name: 'Khu pho 1', code: 'KP1', ward: 'Phuong 1', district: 'Q1', city: 'HCM', createdAt: new Date(), updatedAt: new Date() },
        author: { id: leaderUser.id, fullName: leaderUser.fullName, role: Role.leader },
        attachments: [],
        comments: [],
      };

      prismaMock.announcement.create.mockResolvedValue(createdAnn);
      prismaMock.announcement.findUnique.mockResolvedValue(createdAnn);
      prismaMock.account.findMany.mockResolvedValue([
        { id: 'resident-1' },
        { id: 'resident-2' },
      ]);

      const result = await service.create(leaderUser, {
        title: 'Hop to dan pho',
        content: 'Noi dung hop to dan pho',
        scope: AnnouncementScope.NEIGHBORHOOD,
      });

      expect(result.id).toBe('ann-1');
      expect(notificationsServiceMock.createBatchNotifications).toHaveBeenCalled();
    });

    it('should cleanup staged files if database transaction fails', async () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
      const validFile = createMockMulterFile('doc.pdf', 'application/pdf', pdfBuffer);

      prismaMock.$transaction.mockRejectedValue(new Error('DB Connection Failed'));

      await expect(
        service.create(
          leaderUser,
          {
            title: 'Title',
            content: 'Content',
            scope: AnnouncementScope.NEIGHBORHOOD,
          },
          [validFile],
        ),
      ).rejects.toThrowError('DB Connection Failed');

      expect(storageServiceMock.cleanupFiles).toHaveBeenCalled();
    });
  });

  describe('Edit & Soft Removal', () => {
    it('should forbid leader from editing another leader announcement', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-2',
        title: 'Ann 2',
        content: 'Content',
        status: DbAnnouncementStatus.published,
        authorId: otherLeaderUser.id,
        neighborhoodId: otherLeaderUser.neighborhoodId,
      });

      await expect(
        service.update('ann-2', leaderUser, { title: 'Updated' }),
      ).rejects.toThrowError(AppException);
    });

    it('should allow author or officer to soft-remove announcement without deleting data', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        authorId: leaderUser.id,
        neighborhoodId: leaderUser.neighborhoodId,
      });
      prismaMock.announcement.update.mockResolvedValue({
        id: 'ann-1',
        status: DbAnnouncementStatus.removed,
      });

      const res = await service.remove('ann-1', leaderUser);
      expect(res.success).toBe(true);
      expect(prismaMock.announcement.update).toHaveBeenCalledWith({
        where: { id: 'ann-1' },
        data: { status: DbAnnouncementStatus.removed },
      });
    });
  });

  describe('Comments & Moderation', () => {
    it('should reject comment on a soft-removed announcement', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        scope: DbAnnouncementScope.neighborhood,
        neighborhoodId: 'neigh-1',
        status: DbAnnouncementStatus.removed,
        authorId: leaderUser.id,
      });

      await expect(
        service.createComment('ann-1', residentUser, { content: 'Nice' }),
      ).rejects.toThrowError(AppException);
    });

    it('should notify author atomically when another user comments and trigger push post-commit', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        title: 'Announcement Title',
        scope: DbAnnouncementScope.neighborhood,
        neighborhoodId: 'neigh-1',
        status: DbAnnouncementStatus.published,
        authorId: leaderUser.id,
      });

      prismaMock.comment.create.mockResolvedValue({
        id: 'comment-1',
        announcementId: 'ann-1',
        authorId: residentUser.id,
        content: 'Great update!',
        isRemoved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: {
          id: residentUser.id,
          fullName: residentUser.fullName,
          role: Role.resident,
          neighborhoodId: residentUser.neighborhoodId,
        },
      });

      await service.createComment('ann-1', residentUser, {
        content: 'Great update!',
      });

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(notificationsServiceMock.createNotification).toHaveBeenCalled();
      expect(notificationsServiceMock.sendPushNotifications).toHaveBeenCalledWith(
        [leaderUser.id],
        expect.objectContaining({ referenceId: 'ann-1' }),
      );
    });

    it('should rollback and not trigger push if notification persistence fails in transaction', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        title: 'Announcement Title',
        scope: DbAnnouncementScope.neighborhood,
        neighborhoodId: 'neigh-1',
        status: DbAnnouncementStatus.published,
        authorId: leaderUser.id,
      });

      notificationsServiceMock.createNotification.mockRejectedValue(
        new Error('Notification DB failure'),
      );

      await expect(
        service.createComment('ann-1', residentUser, { content: 'Will fail' }),
      ).rejects.toThrowError('Notification DB failure');

      expect(notificationsServiceMock.sendPushNotifications).not.toHaveBeenCalled();
    });

    it('should not create notification when author comments on own announcement', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        title: 'Announcement Title',
        scope: DbAnnouncementScope.neighborhood,
        neighborhoodId: 'neigh-1',
        status: DbAnnouncementStatus.published,
        authorId: leaderUser.id,
      });

      prismaMock.comment.create.mockResolvedValue({
        id: 'comment-2',
        announcementId: 'ann-1',
        authorId: leaderUser.id,
        content: 'Author follow up',
        isRemoved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: {
          id: leaderUser.id,
          fullName: leaderUser.fullName,
          role: Role.leader,
          neighborhoodId: leaderUser.neighborhoodId,
        },
      });

      await service.createComment('ann-1', leaderUser, {
        content: 'Author follow up',
      });

      expect(notificationsServiceMock.createNotification).not.toHaveBeenCalled();
      expect(notificationsServiceMock.sendPushNotifications).not.toHaveBeenCalled();
    });

    it('should permit leader to moderate comment only within assigned neighborhood', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        neighborhoodId: 'neigh-1',
      });
      prismaMock.comment.findFirst.mockResolvedValue({
        id: 'c-1',
        announcementId: 'ann-1',
        content: 'Bad comment',
        author: { id: 'resident-1', fullName: 'Res 1', role: Role.resident },
      });
      prismaMock.comment.update.mockResolvedValue({
        id: 'c-1',
        announcementId: 'ann-1',
        authorId: 'resident-1',
        content: 'Bad comment',
        isRemoved: true,
        removedReason: 'Spam',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: 'resident-1', fullName: 'Res 1', role: Role.resident },
      });

      const res = await service.moderateComment('ann-1', 'c-1', leaderUser, {
        isRemoved: true,
        removedReason: 'Spam',
      });
      expect(res.isRemoved).toBe(true);

      // Other leader should be forbidden
      await expect(
        service.moderateComment('ann-1', 'c-1', otherLeaderUser, {
          isRemoved: true,
        }),
      ).rejects.toThrowError(AppException);
    });

    it('should preserve the first moderation decision and reject reopening or overwriting it', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        neighborhoodId: 'neigh-1',
      });
      prismaMock.comment.findFirst.mockResolvedValue({
        id: 'c-1',
        announcementId: 'ann-1',
        authorId: 'resident-1',
        content: 'Hidden comment',
        isRemoved: true,
        removedReason: 'Original reason',
        removedBy: 'leader-1',
        author: { id: 'resident-1', fullName: 'Res 1', role: Role.resident },
      });

      await expect(
        service.moderateComment('ann-1', 'c-1', officerUser, {
          isRemoved: true,
          removedReason: 'Replacement reason',
        }),
      ).rejects.toThrowError(AppException);

      await expect(
        service.moderateComment('ann-1', 'c-1', officerUser, {
          isRemoved: false,
        }),
      ).rejects.toThrowError(AppException);

      expect(prismaMock.comment.update).not.toHaveBeenCalled();
    });
  });
});
