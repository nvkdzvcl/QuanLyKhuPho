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

  const unassignedResidentUser: UserDto = {
    id: 'resident-unassigned',
    maskedPhone: '090***9999',
    fullName: 'Unassigned Resident',
    role: UserRole.RESIDENT,
    status: AccountStatus.ACTIVE,
    address: null,
    neighborhoodId: null,
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

    it('should order feed items newest-first and apply search/scope filters', async () => {
      prismaMock.announcement.findMany.mockResolvedValue([]);
      prismaMock.announcement.count.mockResolvedValue(0);

      const result = await service.getFeed(residentUser, {
        page: 2,
        limit: 10,
        search: 'họp dân phố',
      });

      expect(prismaMock.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          skip: 10,
          take: 10,
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { status: DbAnnouncementStatus.published },
              {
                OR: [
                  { title: { contains: 'họp dân phố', mode: 'insensitive' } },
                  { content: { contains: 'họp dân phố', mode: 'insensitive' } },
                ],
              },
            ]),
          }),
        }),
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('should filter feed by specific scope (WARD vs NEIGHBORHOOD) for resident', async () => {
      prismaMock.announcement.findMany.mockResolvedValue([]);
      prismaMock.announcement.count.mockResolvedValue(0);

      await service.getFeed(residentUser, { scope: AnnouncementScope.WARD });
      let whereArg = (prismaMock.announcement.findMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } }).where;
      expect(whereArg.AND).toContainEqual({ scope: DbAnnouncementScope.ward });

      prismaMock.announcement.findMany.mockClear();

      await service.getFeed(residentUser, { scope: AnnouncementScope.NEIGHBORHOOD });
      whereArg = (prismaMock.announcement.findMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } }).where;
      expect(whereArg.AND).toContainEqual({
        scope: DbAnnouncementScope.neighborhood,
        neighborhoodId: residentUser.neighborhoodId,
      });
    });

    it('should allow unassigned resident to view only ward-wide announcements in feed', async () => {
      prismaMock.announcement.findMany.mockResolvedValue([]);
      prismaMock.announcement.count.mockResolvedValue(0);

      await service.getFeed(unassignedResidentUser, {});
      const whereArg = (prismaMock.announcement.findMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } }).where;
      expect(whereArg.AND).toContainEqual({ scope: DbAnnouncementScope.ward });
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

    it('should allow officer to create ward-wide announcement and notify all active accounts across the ward', async () => {
      const createdAnn = {
        id: 'ann-ward-1',
        title: 'Thong bao toan phuong',
        content: 'Noi dung toan phuong',
        scope: DbAnnouncementScope.ward,
        status: DbAnnouncementStatus.published,
        neighborhoodId: null,
        authorId: officerUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: null,
        author: { id: officerUser.id, fullName: officerUser.fullName, role: Role.officer },
        attachments: [],
        comments: [],
      };

      prismaMock.announcement.create.mockResolvedValue(createdAnn);
      prismaMock.announcement.findUnique.mockResolvedValue(createdAnn);
      prismaMock.account.findMany.mockResolvedValue([
        { id: 'resident-1' },
        { id: 'leader-1' },
        { id: 'leader-2' },
      ]);

      const result = await service.create(officerUser, {
        title: 'Thong bao toan phuong',
        content: 'Noi dung toan phuong',
        scope: AnnouncementScope.WARD,
      });

      expect(result.id).toBe('ann-ward-1');
      expect(result.scope).toBe(AnnouncementScope.WARD);
      expect(prismaMock.announcement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scope: DbAnnouncementScope.ward,
            neighborhoodId: null,
            authorId: officerUser.id,
          }),
        }),
      );
      expect(prismaMock.account.findMany).toHaveBeenCalledWith({
        where: {
          status: AccountStatus.ACTIVE,
          id: { not: officerUser.id },
        },
        select: { id: true },
      });
      expect(notificationsServiceMock.createBatchNotifications).toHaveBeenCalledWith(
        expect.anything(),
        ['resident-1', 'leader-1', 'leader-2'],
        expect.objectContaining({
          title: expect.stringContaining('Toàn phường'),
          type: 'announcement',
          referenceId: 'ann-ward-1',
        }),
      );
    });

    it('should allow officer to create neighborhood announcement with valid neighborhoodId', async () => {
      prismaMock.neighborhood.findUnique.mockResolvedValue({
        id: 'neigh-1',
        name: 'Khu pho 1',
      });

      const createdAnn = {
        id: 'ann-officer-neigh-1',
        title: 'Thong bao dac thu KP1',
        content: 'Noi dung KP1',
        scope: DbAnnouncementScope.neighborhood,
        status: DbAnnouncementStatus.published,
        neighborhoodId: 'neigh-1',
        authorId: officerUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: { id: 'neigh-1', name: 'Khu pho 1', code: 'KP1', ward: 'Phuong 1', district: 'Q1', city: 'HCM', createdAt: new Date(), updatedAt: new Date() },
        author: { id: officerUser.id, fullName: officerUser.fullName, role: Role.officer },
        attachments: [],
        comments: [],
      };

      prismaMock.announcement.create.mockResolvedValue(createdAnn);
      prismaMock.announcement.findUnique.mockResolvedValue(createdAnn);
      prismaMock.account.findMany.mockResolvedValue([{ id: 'resident-1' }]);

      const result = await service.create(officerUser, {
        title: 'Thong bao dac thu KP1',
        content: 'Noi dung KP1',
        scope: AnnouncementScope.NEIGHBORHOOD,
        neighborhoodId: 'neigh-1',
      });

      expect(result.id).toBe('ann-officer-neigh-1');
      expect(prismaMock.account.findMany).toHaveBeenCalledWith({
        where: {
          status: AccountStatus.ACTIVE,
          id: { not: officerUser.id },
          neighborhoodId: 'neigh-1',
        },
        select: { id: true },
      });
    });

    it('should reject officer creating neighborhood announcement without neighborhoodId or with non-existent neighborhood', async () => {
      await expect(
        service.create(officerUser, {
          title: 'Thong bao',
          content: 'Noi dung',
          scope: AnnouncementScope.NEIGHBORHOOD,
        }),
      ).rejects.toThrowError(AppException);

      prismaMock.neighborhood.findUnique.mockResolvedValue(null);

      await expect(
        service.create(officerUser, {
          title: 'Thong bao',
          content: 'Noi dung',
          scope: AnnouncementScope.NEIGHBORHOOD,
          neighborhoodId: 'non-existent',
        }),
      ).rejects.toThrowError(AppException);
    });

    it('should reject leader with no neighborhoodId from creating announcement', async () => {
      const unassignedLeader: UserDto = {
        ...leaderUser,
        neighborhoodId: null,
      };

      await expect(
        service.create(unassignedLeader, {
          title: 'Title',
          content: 'Content',
          scope: AnnouncementScope.NEIGHBORHOOD,
        }),
      ).rejects.toThrowError(AppException);
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
    it('should allow author leader and officer to successfully edit an active announcement', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        title: 'Original Title',
        content: 'Original Content',
        status: DbAnnouncementStatus.published,
        authorId: leaderUser.id,
        neighborhoodId: leaderUser.neighborhoodId,
        neighborhood: { id: 'neigh-1', name: 'Khu pho 1', code: 'KP1', ward: 'Phuong 1', district: 'Q1', city: 'HCM', createdAt: new Date(), updatedAt: new Date() },
        author: { id: leaderUser.id, fullName: leaderUser.fullName, role: Role.leader },
        attachments: [],
        comments: [],
      });

      const updatedAnn = {
        id: 'ann-1',
        title: 'Updated Title',
        content: 'Updated Content',
        scope: DbAnnouncementScope.neighborhood,
        status: DbAnnouncementStatus.published,
        neighborhoodId: leaderUser.neighborhoodId,
        authorId: leaderUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: { id: 'neigh-1', name: 'Khu pho 1', code: 'KP1', ward: 'Phuong 1', district: 'Q1', city: 'HCM', createdAt: new Date(), updatedAt: new Date() },
        author: { id: leaderUser.id, fullName: leaderUser.fullName, role: Role.leader },
        attachments: [],
        comments: [],
      };
      prismaMock.announcement.update.mockResolvedValue(updatedAnn);

      const leaderResult = await service.update('ann-1', leaderUser, {
        title: 'Updated Title',
        content: 'Updated Content',
      });
      expect(leaderResult.title).toBe('Updated Title');
      expect(prismaMock.announcement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ann-1' },
          data: { title: 'Updated Title', content: 'Updated Content' },
        }),
      );

      // Officer can also edit
      const officerResult = await service.update('ann-1', officerUser, {
        title: 'Officer Updated Title',
      });
      expect(officerResult).toBeDefined();
    });

    it('should reject resident attempting to edit an announcement (403 FORBIDDEN)', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        title: 'Title',
        status: DbAnnouncementStatus.published,
        authorId: leaderUser.id,
        neighborhoodId: 'neigh-1',
      });

      await expect(
        service.update('ann-1', residentUser, { title: 'Resident update' }),
      ).rejects.toThrowError(AppException);
    });

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

    it('should reject editing an announcement that has been soft-removed (400 BAD_REQUEST)', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        title: 'Title',
        status: DbAnnouncementStatus.removed,
        authorId: leaderUser.id,
        neighborhoodId: leaderUser.neighborhoodId,
      });

      await expect(
        service.update('ann-1', leaderUser, { title: 'Update removed' }),
      ).rejects.toThrowError(AppException);
    });

    it('should reject resident attempting to remove an announcement (403 FORBIDDEN)', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        authorId: leaderUser.id,
        neighborhoodId: 'neigh-1',
      });

      await expect(service.remove('ann-1', residentUser)).rejects.toThrowError(AppException);
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

    it('should allow officer to soft-remove any announcement', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        authorId: leaderUser.id,
        neighborhoodId: leaderUser.neighborhoodId,
      });
      prismaMock.announcement.update.mockResolvedValue({
        id: 'ann-1',
        status: DbAnnouncementStatus.removed,
      });

      const res = await service.remove('ann-1', officerUser);
      expect(res.success).toBe(true);
      expect(prismaMock.announcement.update).toHaveBeenCalledWith({
        where: { id: 'ann-1' },
        data: { status: DbAnnouncementStatus.removed },
      });
    });
  });

  describe('Detail & Attachment Download Scope', () => {
    const mockDetailAnn = {
      id: 'ann-detail-1',
      title: 'Chi tiet thong bao',
      content: 'Noi dung chi tiet',
      scope: DbAnnouncementScope.neighborhood,
      status: DbAnnouncementStatus.published,
      neighborhoodId: 'neigh-1',
      authorId: leaderUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      neighborhood: { id: 'neigh-1', name: 'Khu pho 1', code: 'KP1', ward: 'Phuong 1', district: 'Q1', city: 'HCM', createdAt: new Date(), updatedAt: new Date() },
      author: { id: leaderUser.id, fullName: leaderUser.fullName, role: Role.leader },
      attachments: [
        {
          id: 'att-1',
          announcementId: 'ann-detail-1',
          fileName: 'guidelines.pdf',
          originalName: 'guidelines.pdf',
          mimeType: 'application/pdf',
          fileSize: 2048,
          filePath: '/uploads/guidelines.pdf',
          createdAt: new Date(),
        },
      ],
      comments: [
        {
          id: 'com-1',
          announcementId: 'ann-detail-1',
          authorId: 'resident-2',
          content: 'Normal comment',
          isRemoved: false,
          removedReason: null,
          removedBy: null,
          createdAt: new Date('2026-08-20T10:00:00.000Z'),
          updatedAt: new Date('2026-08-20T10:00:00.000Z'),
          author: { id: 'resident-2', fullName: 'Nguyen B', role: Role.resident, neighborhoodId: 'neigh-1' },
        },
        {
          id: 'com-2',
          announcementId: 'ann-detail-1',
          authorId: 'resident-3',
          content: 'Inappropriate content',
          isRemoved: true,
          removedReason: 'Spam advertising',
          removedBy: leaderUser.id,
          createdAt: new Date('2026-08-20T11:00:00.000Z'),
          updatedAt: new Date('2026-08-20T11:00:00.000Z'),
          author: { id: 'resident-3', fullName: 'Le C', role: Role.resident, neighborhoodId: 'neigh-1' },
        },
      ],
    };

    it('should return announcement detail with attachments and chronological comments, masking removed comments for regular users', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(mockDetailAnn);

      const detail = await service.getDetail('ann-detail-1', residentUser);
      expect(detail.id).toBe('ann-detail-1');
      expect(detail.attachments).toHaveLength(1);
      expect(detail.comments).toHaveLength(2);
      expect(detail.comments[0]?.content).toBe('Normal comment');
      expect(detail.comments[1]?.content).toBe('[Bình luận này đã bị ẩn bởi ban quản trị]');
      expect(detail.comments[1]?.removedReason).toBeNull();
    });

    it('should reveal removed comment content and reason to moderators and the comment author', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(mockDetailAnn);

      // Leader of the neighborhood (moderator)
      const leaderDetail = await service.getDetail('ann-detail-1', leaderUser);
      expect(leaderDetail.comments[1]?.content).toBe('Inappropriate content');
      expect(leaderDetail.comments[1]?.removedReason).toBe('Spam advertising');

      // Officer (moderator)
      const officerDetail = await service.getDetail('ann-detail-1', officerUser);
      expect(officerDetail.comments[1]?.content).toBe('Inappropriate content');
      expect(officerDetail.comments[1]?.removedReason).toBe('Spam advertising');

      // The author of the removed comment
      const authorUser: UserDto = {
        ...residentUser,
        id: 'resident-3',
      };
      const authorDetail = await service.getDetail('ann-detail-1', authorUser);
      expect(authorDetail.comments[1]?.content).toBe('Inappropriate content');
      expect(authorDetail.comments[1]?.removedReason).toBe('Spam advertising');
    });

    it('should forbid resident from viewing detail of announcement in another neighborhood', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        ...mockDetailAnn,
        neighborhoodId: 'neigh-2',
      });

      await expect(
        service.getDetail('ann-detail-1', residentUser),
      ).rejects.toThrowError(AppException);
    });

    it('should allow author or officer to view detail of soft-removed announcement, but deny other residents', async () => {
      const removedAnn = {
        ...mockDetailAnn,
        status: DbAnnouncementStatus.removed,
      };
      prismaMock.announcement.findUnique.mockResolvedValue(removedAnn);

      // Author sees it
      const authorView = await service.getDetail('ann-detail-1', leaderUser);
      expect(authorView.id).toBe('ann-detail-1');

      // Officer sees it
      const officerView = await service.getDetail('ann-detail-1', officerUser);
      expect(officerView.id).toBe('ann-detail-1');

      // Other resident is denied
      await expect(
        service.getDetail('ann-detail-1', residentUser),
      ).rejects.toThrowError(AppException);
    });

    it('should throw 404 when announcement detail is not found', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(null);

      await expect(
        service.getDetail('non-existent', residentUser),
      ).rejects.toThrowError(AppException);
    });

    it('should allow authorized user to download attachment and verify metadata', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(mockDetailAnn);
      prismaMock.attachment.findFirst.mockResolvedValue({
        id: 'att-1',
        announcementId: 'ann-detail-1',
        fileName: 'guidelines.pdf',
        originalName: 'guidelines.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
      });
      storageServiceMock.resolveAttachmentPath.mockResolvedValue('/uploads/guidelines.pdf');

      const result = await service.downloadAttachment('ann-detail-1', 'att-1', residentUser);
      expect(result.filePath).toBe('/uploads/guidelines.pdf');
      expect(result.originalName).toBe('guidelines.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileSize).toBe(2048);
      expect(storageServiceMock.resolveAttachmentPath).toHaveBeenCalledWith('guidelines.pdf');
    });

    it('should reject download for cross-neighborhood resident (403 FORBIDDEN)', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        ...mockDetailAnn,
        neighborhoodId: 'neigh-2',
      });

      await expect(
        service.downloadAttachment('ann-detail-1', 'att-1', residentUser),
      ).rejects.toThrowError(AppException);
    });

    it('should throw 404 when attachment not found on download', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(mockDetailAnn);
      prismaMock.attachment.findFirst.mockResolvedValue(null);

      await expect(
        service.downloadAttachment('ann-detail-1', 'att-missing', residentUser),
      ).rejects.toThrowError(AppException);
    });
  });

  describe('Comments & Moderation', () => {
    it('should reject empty or whitespace-only comment (400 VALIDATION_ERROR)', async () => {
      await expect(
        service.createComment('ann-1', residentUser, { content: '   ' }),
      ).rejects.toThrowError(AppException);

      await expect(
        service.createComment('ann-1', residentUser, { content: '' }),
      ).rejects.toThrowError(AppException);
    });

    it('should forbid resident from commenting on announcement in another neighborhood (403 FORBIDDEN)', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-other',
        scope: DbAnnouncementScope.neighborhood,
        neighborhoodId: 'neigh-2',
        status: DbAnnouncementStatus.published,
        authorId: otherLeaderUser.id,
      });

      await expect(
        service.createComment('ann-other', residentUser, { content: 'Hello' }),
      ).rejects.toThrowError(AppException);
    });

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

    it('should forbid resident from moderating comments (403 FORBIDDEN)', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        neighborhoodId: 'neigh-1',
      });
      prismaMock.comment.findFirst.mockResolvedValue({
        id: 'c-1',
        announcementId: 'ann-1',
        authorId: 'resident-2',
        isRemoved: false,
        author: { id: 'resident-2', fullName: 'Res 2', role: Role.resident },
      });

      await expect(
        service.moderateComment('ann-1', 'c-1', residentUser, { isRemoved: true }),
      ).rejects.toThrowError(AppException);
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

    it('should allow officer to moderate comments across any neighborhood announcement', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        neighborhoodId: 'neigh-1',
      });
      prismaMock.comment.findFirst.mockResolvedValue({
        id: 'c-1',
        announcementId: 'ann-1',
        authorId: 'resident-2',
        content: 'Officer target comment',
        isRemoved: false,
        author: { id: 'resident-2', fullName: 'Res 2', role: Role.resident },
      });
      prismaMock.comment.update.mockResolvedValue({
        id: 'c-1',
        announcementId: 'ann-1',
        authorId: 'resident-2',
        content: 'Officer target comment',
        isRemoved: true,
        removedReason: 'Officer moderation',
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: 'resident-2', fullName: 'Res 2', role: Role.resident },
      });

      const res = await service.moderateComment('ann-1', 'c-1', officerUser, {
        isRemoved: true,
        removedReason: 'Officer moderation',
      });

      expect(res.isRemoved).toBe(true);
      expect(prismaMock.comment.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: {
          isRemoved: true,
          removedReason: 'Officer moderation',
          removedBy: officerUser.id,
        },
        include: { author: true },
      });
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
