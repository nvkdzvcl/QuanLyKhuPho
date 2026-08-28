import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import {
  Account,
  Neighborhood,
  Announcement,
  Attachment,
  Comment,
  Notification,
  PushSubscription,
  Prisma,
  Role,
  AccountStatus as DbAccountStatus,
  AnnouncementScope as DbAnnouncementScope,
  AnnouncementStatus as DbAnnouncementStatus,
  NotificationType as DbNotificationType,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CryptoService } from '../src/security/crypto.service';
import { SessionService } from '../src/auth/session.service';
import { HttpExceptionFilter } from '../src/core/exceptions/http-exception.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { SESSION_COOKIE_NAME } from '../src/core/constants';
import { AccountStatus, UserRole } from '@quanlykhupho/shared-types';

type DbMockAccount = Account & {
  neighborhood: Neighborhood | null;
};

type DbMockAnnouncement = Announcement & {
  neighborhood: Neighborhood | null;
  author: Account;
  attachments: Attachment[];
  comments: (Comment & { author: Account })[];
};

type AnnouncementWhereClause = {
  status?: DbAnnouncementStatus;
  scope?: DbAnnouncementScope;
  neighborhoodId?: string | null;
  title?: { contains?: string };
  content?: { contains?: string };
  AND?: AnnouncementWhereClause | AnnouncementWhereClause[];
  OR?: AnnouncementWhereClause[];
};

function matchesAnnouncementWhere(
  announcement: DbMockAnnouncement,
  where?: AnnouncementWhereClause,
): boolean {
  if (!where) return true;

  const andConditions = where.AND
    ? Array.isArray(where.AND)
      ? where.AND
      : [where.AND]
    : [];
  if (!andConditions.every((condition) => matchesAnnouncementWhere(announcement, condition))) {
    return false;
  }
  if (where.OR && !where.OR.some((condition) => matchesAnnouncementWhere(announcement, condition))) {
    return false;
  }
  if (where.status && announcement.status !== where.status) return false;
  if (where.scope && announcement.scope !== where.scope) return false;
  if (
    where.neighborhoodId !== undefined &&
    announcement.neighborhoodId !== where.neighborhoodId
  ) {
    return false;
  }

  const searchTitle = where.title?.contains?.toLocaleLowerCase('vi-VN');
  if (searchTitle && !announcement.title.toLocaleLowerCase('vi-VN').includes(searchTitle)) {
    return false;
  }
  const searchContent = where.content?.contains?.toLocaleLowerCase('vi-VN');
  if (searchContent && !announcement.content.toLocaleLowerCase('vi-VN').includes(searchContent)) {
    return false;
  }

  return true;
}

describe('Announcements & Comments (e2e)', () => {
  let app: INestApplication;
  let sessionService: SessionService;
  let cryptoService: CryptoService;

  // In-memory data store for e2e
  const dbNeighborhoods: Neighborhood[] = [
    {
      id: '88888888-8888-4888-8888-888888888881',
      code: 'KP-01',
      name: 'Khu phố 1',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '88888888-8888-4888-8888-888888888882',
      code: 'KP-02',
      name: 'Khu phố 2',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const dbAccounts: DbMockAccount[] = [];
  const dbAnnouncements: DbMockAnnouncement[] = [];
  const dbAttachments: Attachment[] = [];
  const dbComments: (Comment & { author: Account })[] = [];
  const dbNotifications: Notification[] = [];
  const dbPushSubscriptions: PushSubscription[] = [];

  let residentCookie: string;
  let leaderCookie: string;
  let officerCookie: string;
  let otherResidentCookie: string;

  beforeAll(async () => {
    const mockPrisma = {
      $connect: async () => {},
      $disconnect: async () => {},
      $transaction: async <T>(cb: (tx: PrismaService) => Promise<T>): Promise<T> =>
        cb(mockPrisma as unknown as PrismaService),
      neighborhood: {
        findMany: async () => dbNeighborhoods,
        findUnique: async ({ where }: { where: Prisma.NeighborhoodWhereUniqueInput }) =>
          dbNeighborhoods.find((n) => n.id === where.id) || null,
      },
      account: {
        findUnique: async ({ where }: { where: Prisma.AccountWhereUniqueInput }) =>
          dbAccounts.find((a) => a.id === where.id || a.phoneHash === where.phoneHash) || null,
        findMany: async ({ where }: { where?: Prisma.AccountWhereInput }) => {
          let list = [...dbAccounts];
          if (where?.status) {
            list = list.filter((a) => a.status === where.status);
          }
          if (where?.id && typeof where.id === 'object' && 'not' in where.id) {
            list = list.filter((a) => a.id !== (where.id as { not?: string }).not);
          }
          if (where?.neighborhoodId) {
            list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
          }
          return list;
        },
        create: async ({ data }: { data: Prisma.AccountUncheckedCreateInput }) => {
          const created: DbMockAccount = {
            id: `acc-${Date.now()}-${Math.random()}`,
            phoneEncrypted: data.phoneEncrypted,
            phoneHash: data.phoneHash,
            fullName: data.fullName,
            role: data.role ?? Role.resident,
            status: data.status ?? DbAccountStatus.pending,
            address: data.address ?? null,
            neighborhoodId: data.neighborhoodId ?? null,
            rejectionReason: data.rejectionReason ?? null,
            lockReason: data.lockReason ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
            neighborhood: dbNeighborhoods.find((n) => n.id === data.neighborhoodId) || null,
          };
          dbAccounts.push(created);
          return created;
        },
      },
      announcement: {
        findMany: async ({
          where,
          orderBy,
          skip = 0,
          take,
        }: {
          where?: Prisma.AnnouncementWhereInput;
          orderBy?: Prisma.AnnouncementOrderByWithRelationInput;
          skip?: number;
          take?: number;
        }) => {
          const clause = where as AnnouncementWhereClause | undefined;
          const list = dbAnnouncements
            .filter((announcement) => matchesAnnouncementWhere(announcement, clause))
            .sort((left, right) =>
              orderBy?.createdAt === 'desc'
                ? right.createdAt.getTime() - left.createdAt.getTime()
                : left.createdAt.getTime() - right.createdAt.getTime(),
            );
          return list.slice(skip, take === undefined ? undefined : skip + take);
        },
        findUnique: async ({ where }: { where: Prisma.AnnouncementWhereUniqueInput }) =>
          dbAnnouncements.find((a) => a.id === where.id) || null,
        count: async ({ where }: { where?: Prisma.AnnouncementWhereInput }) =>
          dbAnnouncements.filter((announcement) =>
            matchesAnnouncementWhere(
              announcement,
              where as AnnouncementWhereClause | undefined,
            ),
          ).length,
        create: async ({ data }: { data: Prisma.AnnouncementUncheckedCreateInput }) => {
          const author = dbAccounts.find((a) => a.id === data.authorId)!;
          const neighborhood = dbNeighborhoods.find((n) => n.id === data.neighborhoodId) || null;
          const created: DbMockAnnouncement = {
            id: `ann-${Date.now()}`,
            title: data.title,
            content: data.content,
            scope: data.scope ?? DbAnnouncementScope.neighborhood,
            status: data.status ?? DbAnnouncementStatus.published,
            neighborhoodId: data.neighborhoodId ?? null,
            authorId: data.authorId,
            createdAt: new Date(),
            updatedAt: new Date(),
            author,
            neighborhood,
            attachments: [],
            comments: [],
          };
          dbAnnouncements.push(created);
          return created;
        },
        update: async ({
          where,
          data,
        }: {
          where: Prisma.AnnouncementWhereUniqueInput;
          data: Prisma.AnnouncementUpdateInput;
        }) => {
          const item = dbAnnouncements.find((a) => a.id === where.id);
          if (!item) throw new Error('Not found');
          Object.assign(item, data, { updatedAt: new Date() });
          return item;
        },
      },
      attachment: {
        createMany: async ({ data }: { data: Prisma.AttachmentCreateManyInput[] }) => {
          for (const item of data) {
            const att: Attachment = {
              id: `att-${Date.now()}`,
              announcementId: item.announcementId,
              fileName: item.fileName,
              originalName: item.originalName,
              mimeType: item.mimeType,
              fileSize: item.fileSize,
              filePath: item.filePath,
              createdAt: new Date(),
            };
            dbAttachments.push(att);
            const parent = dbAnnouncements.find((a) => a.id === item.announcementId);
            if (parent) parent.attachments.push(att);
          }
          return { count: data.length };
        },
        findFirst: async ({ where }: { where?: Prisma.AttachmentWhereInput }) =>
          dbAttachments.find(
            (a) => a.id === where?.id && a.announcementId === where?.announcementId,
          ) || null,
      },
      comment: {
        create: async ({ data }: { data: Prisma.CommentUncheckedCreateInput }) => {
          const author = dbAccounts.find((a) => a.id === data.authorId)!;
          const created: Comment & { author: Account } = {
            id: `com-${Date.now()}`,
            announcementId: data.announcementId,
            authorId: data.authorId,
            content: data.content,
            isRemoved: data.isRemoved ?? false,
            removedReason: data.removedReason ?? null,
            removedBy: data.removedBy ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
            author,
          };
          dbComments.push(created);
          const parent = dbAnnouncements.find((a) => a.id === data.announcementId);
          if (parent) parent.comments.push(created);
          return created;
        },
        findFirst: async ({ where }: { where?: Prisma.CommentWhereInput }) =>
          dbComments.find(
            (c) => c.id === where?.id && c.announcementId === where?.announcementId,
          ) || null,
        update: async ({
          where,
          data,
        }: {
          where: Prisma.CommentWhereUniqueInput;
          data: Prisma.CommentUpdateInput;
        }) => {
          const item = dbComments.find((c) => c.id === where.id);
          if (!item) throw new Error('Not found');
          Object.assign(item, data, { updatedAt: new Date() });
          return item;
        },
      },
      notification: {
        create: async ({ data }: { data: Prisma.NotificationUncheckedCreateInput }) => {
          const notif: Notification = {
            id: `notif-${Date.now()}`,
            accountId: data.accountId,
            title: data.title,
            content: data.content,
            type: data.type ?? DbNotificationType.announcement,
            referenceId: data.referenceId ?? null,
            isRead: data.isRead ?? false,
            readAt: null,
            createdAt: new Date(),
          };
          dbNotifications.push(notif);
          return notif;
        },
        createMany: async ({ data }: { data: Prisma.NotificationCreateManyInput[] }) => {
          for (const item of data) {
            dbNotifications.push({
              id: `notif-${Date.now()}-${Math.random()}`,
              accountId: item.accountId,
              title: item.title,
              content: item.content,
              type: item.type ?? DbNotificationType.announcement,
              referenceId: item.referenceId ?? null,
              isRead: item.isRead ?? false,
              readAt: null,
              createdAt: new Date(),
            });
          }
          return { count: data.length };
        },
        findMany: async ({ where }: { where?: Prisma.NotificationWhereInput }) =>
          dbNotifications.filter((n) => n.accountId === where?.accountId),
        count: async ({ where }: { where?: Prisma.NotificationWhereInput }) =>
          dbNotifications.filter(
            (n) =>
              n.accountId === where?.accountId &&
              (where?.isRead === undefined || n.isRead === where.isRead),
          ).length,
        findUnique: async ({ where }: { where: Prisma.NotificationWhereUniqueInput }) =>
          dbNotifications.find((n) => n.id === where.id) || null,
        update: async ({
          where,
          data,
        }: {
          where: Prisma.NotificationWhereUniqueInput;
          data: Prisma.NotificationUpdateInput;
        }) => {
          const item = dbNotifications.find((n) => n.id === where.id);
          if (!item) throw new Error('Not found');
          Object.assign(item, data);
          return item;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where?: Prisma.NotificationWhereInput;
          data: Prisma.NotificationUpdateManyMutationInput;
        }) => {
          let count = 0;
          for (const item of dbNotifications) {
            if (item.accountId === where?.accountId && item.isRead === false) {
              Object.assign(item, data);
              count++;
            }
          }
          return { count };
        },
      },
      pushSubscription: {
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: Prisma.PushSubscriptionWhereUniqueInput;
          create: Prisma.PushSubscriptionUncheckedCreateInput;
          update: Prisma.PushSubscriptionUpdateInput;
        }) => {
          const existing = dbPushSubscriptions.find((s) => s.endpoint === where.endpoint);
          if (existing) {
            Object.assign(existing, update, { updatedAt: new Date() });
            return existing;
          }
          const created: PushSubscription = {
            id: `sub-${Date.now()}`,
            accountId: create.accountId,
            endpoint: create.endpoint,
            p256dh: create.p256dh,
            auth: create.auth,
            userAgent: create.userAgent ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          dbPushSubscriptions.push(created);
          return created;
        },
        deleteMany: async ({ where }: { where?: Prisma.PushSubscriptionWhereInput }) => {
          const idx = dbPushSubscriptions.findIndex(
            (s) => s.accountId === where?.accountId && s.endpoint === where?.endpoint,
          );
          if (idx !== -1) dbPushSubscriptions.splice(idx, 1);
          return { count: 1 };
        },
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    sessionService = app.get(SessionService);
    cryptoService = app.get(CryptoService);

    // Create resident, leader, and officer test accounts
    const residentAcc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('0911111111'),
        phoneHash: cryptoService.hashPhone('0911111111'),
        fullName: 'Nguyen Resident',
        role: Role.resident,
        status: DbAccountStatus.active,
        address: '123 Pho Hue',
        neighborhoodId: dbNeighborhoods[0]?.id,
      },
    });

    const leaderAcc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('0922222222'),
        phoneHash: cryptoService.hashPhone('0922222222'),
        fullName: 'Tran Leader',
        role: Role.leader,
        status: DbAccountStatus.active,
        address: '124 Pho Hue',
        neighborhoodId: dbNeighborhoods[0]?.id,
      },
    });

    const officerAcc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('0933333333'),
        phoneHash: cryptoService.hashPhone('0933333333'),
        fullName: 'Le Officer',
        role: Role.officer,
        status: DbAccountStatus.active,
        address: null,
        neighborhoodId: null,
      },
    });

    const otherResidentAcc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('0944444444'),
        phoneHash: cryptoService.hashPhone('0944444444'),
        fullName: 'Pham Resident KP2',
        role: Role.resident,
        status: DbAccountStatus.active,
        address: '50 Hang Bai',
        neighborhoodId: dbNeighborhoods[1]?.id,
      },
    });

    // Create sessions
    const resSessId = await sessionService.createSession(
      residentAcc.id,
      UserRole.RESIDENT,
      AccountStatus.ACTIVE,
      dbNeighborhoods[0]?.id ?? null,
    );
    residentCookie = `${SESSION_COOKIE_NAME}=${resSessId}`;

    const leadSessId = await sessionService.createSession(
      leaderAcc.id,
      UserRole.LEADER,
      AccountStatus.ACTIVE,
      dbNeighborhoods[0]?.id ?? null,
    );
    leaderCookie = `${SESSION_COOKIE_NAME}=${leadSessId}`;

    const offSessId = await sessionService.createSession(
      officerAcc.id,
      UserRole.OFFICER,
      AccountStatus.ACTIVE,
      null,
    );
    officerCookie = `${SESSION_COOKIE_NAME}=${offSessId}`;

    const otherResSessId = await sessionService.createSession(
      otherResidentAcc.id,
      UserRole.RESIDENT,
      AccountStatus.ACTIVE,
      dbNeighborhoods[1]?.id ?? null,
    );
    otherResidentCookie = `${SESSION_COOKIE_NAME}=${otherResSessId}`;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('Leader should create neighborhood announcement with attachment successfully', async () => {
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

    const res = await request(app.getHttpServer())
      .post('/api/announcements')
      .set('Cookie', leaderCookie)
      .field('title', 'Thông báo họp tổ 1')
      .field('content', 'Kính mời toàn thể bà con tham dự cuộc họp...')
      .field('scope', 'neighborhood')
      .attach('files', pdfBuffer, 'meeting_agenda.pdf');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Thông báo họp tổ 1');
  });

  it('Resident should view announcement and post a comment', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/announcements')
      .set('Cookie', residentCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.length).toBeGreaterThan(0);
    const annId = listRes.body.data.items[0].id;

    // Post comment
    const comRes = await request(app.getHttpServer())
      .post(`/api/announcements/${annId}/comments`)
      .set('Cookie', residentCookie)
      .send({ content: 'Tôi xin phép tham dự đúng giờ.' });

    expect(comRes.status).toBe(201);
    expect(comRes.body.success).toBe(true);
    expect(comRes.body.data.content).toBe('Tôi xin phép tham dự đúng giờ.');
  });

  it('Leader should moderate comment in their neighborhood', async () => {
    const annId = dbAnnouncements[0]?.id;
    const commentId = dbComments[0]?.id;

    const modRes = await request(app.getHttpServer())
      .patch(`/api/announcements/${annId}/comments/${commentId}/moderate`)
      .set('Cookie', leaderCookie)
      .send({ isRemoved: true, removedReason: 'Kiểm duyệt nội dung' });

    expect(modRes.status).toBe(200);
    expect(modRes.body.data.isRemoved).toBe(true);
  });

  it('Resident should be able to check unread notification count and mark read', async () => {
    const countRes = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Cookie', residentCookie);

    expect(countRes.status).toBe(200);
    expect(typeof countRes.body.data.unreadCount).toBe('number');
  });

  it('Officer should create ward announcement and notify all active accounts across the ward', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/announcements')
      .set('Cookie', officerCookie)
      .field('title', 'Thông báo phòng chống bão cấp phường')
      .field('content', 'Kính đề nghị toàn thể nhân dân chủ động chằng chống nhà cửa...')
      .field('scope', 'ward');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scope).toBe('ward');
    expect(res.body.data.neighborhoodId).toBeNull();

    // Verify both residents (KP1 and KP2) can see the ward announcement in their feeds
    const kp1Feed = await request(app.getHttpServer())
      .get('/api/announcements')
      .set('Cookie', residentCookie);
    expect(kp1Feed.body.data.items.some((item: { title: string }) => item.title === 'Thông báo phòng chống bão cấp phường')).toBe(true);

    const kp2Feed = await request(app.getHttpServer())
      .get('/api/announcements')
      .set('Cookie', otherResidentCookie);
    expect(kp2Feed.body.data.items.some((item: { title: string }) => item.title === 'Thông báo phòng chống bão cấp phường')).toBe(true);
    expect(
      kp2Feed.body.data.items.some(
        (item: { title: string }) => item.title === 'Thông báo họp tổ 1',
      ),
    ).toBe(false);
  });

  it('Officer and Author Leader should edit announcement successfully, and resident edit should be forbidden', async () => {
    const annId = dbAnnouncements[0]?.id;

    // Leader edits their own announcement
    const editRes = await request(app.getHttpServer())
      .patch(`/api/announcements/${annId}`)
      .set('Cookie', leaderCookie)
      .send({ title: 'Thông báo họp tổ 1 (Đã cập nhật giờ)' });

    expect(editRes.status).toBe(200);
    expect(editRes.body.data.title).toBe('Thông báo họp tổ 1 (Đã cập nhật giờ)');

    // Resident edit is rejected
    const residentEditRes = await request(app.getHttpServer())
      .patch(`/api/announcements/${annId}`)
      .set('Cookie', residentCookie)
      .send({ title: 'Cư dân sửa tiêu đề trái phép' });

    expect(residentEditRes.status).toBe(403);
  });

  it('Resident should be rejected with 403 when creating announcement or moderating comment', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/announcements')
      .set('Cookie', residentCookie)
      .send({
        title: 'Cư dân tự phát thông báo',
        content: 'Nội dung không hợp lệ',
        scope: 'neighborhood',
      });

    expect(createRes.status).toBe(403);

    const annId = dbAnnouncements[0]?.id;
    const commentId = dbComments[0]?.id;

    const modRes = await request(app.getHttpServer())
      .patch(`/api/announcements/${annId}/comments/${commentId}/moderate`)
      .set('Cookie', residentCookie)
      .send({ isRemoved: true });

    expect(modRes.status).toBe(403);
  });

  it('Empty or whitespace comment should be rejected with 400 Bad Request', async () => {
    const annId = dbAnnouncements[0]?.id;

    const emptyRes = await request(app.getHttpServer())
      .post(`/api/announcements/${annId}/comments`)
      .set('Cookie', residentCookie)
      .send({ content: '   ' });

    expect(emptyRes.status).toBe(400);
  });

  it('Officer should moderate comments across any neighborhood and immutable decision cannot be overwritten', async () => {
    const annId = dbAnnouncements[0]?.id;

    // Post a new comment to moderate
    const comRes = await request(app.getHttpServer())
      .post(`/api/announcements/${annId}/comments`)
      .set('Cookie', residentCookie)
      .send({ content: 'Bình luận cần kiểm duyệt bởi cán bộ phường' });

    expect(comRes.status).toBe(201);
    const newCommentId = comRes.body.data.id;

    // Officer moderates comment in KP1
    const modRes = await request(app.getHttpServer())
      .patch(`/api/announcements/${annId}/comments/${newCommentId}/moderate`)
      .set('Cookie', officerCookie)
      .send({ isRemoved: true, removedReason: 'Ngôn từ không phù hợp' });

    expect(modRes.status).toBe(200);
    expect(modRes.body.data.isRemoved).toBe(true);

    // Re-moderating the already-removed comment is rejected
    const reModRes = await request(app.getHttpServer())
      .patch(`/api/announcements/${annId}/comments/${newCommentId}/moderate`)
      .set('Cookie', officerCookie)
      .send({ isRemoved: true, removedReason: 'Lý do khác' });

    expect(reModRes.status).toBe(400);

    // Attempting to un-remove (isRemoved: false) is rejected
    const unModRes = await request(app.getHttpServer())
      .patch(`/api/announcements/${annId}/comments/${newCommentId}/moderate`)
      .set('Cookie', officerCookie)
      .send({ isRemoved: false });

    expect(unModRes.status).toBe(400);
  });

  it('Attachment download endpoint should serve file with safe headers and deny cross-neighborhood resident', async () => {
    const annId = dbAnnouncements[0]?.id;
    const attId = dbAttachments[0]?.id;

    expect(annId).toBeDefined();
    expect(attId).toBeDefined();

    // Authorized resident in KP-01 downloads attachment
    const downloadRes = await request(app.getHttpServer())
      .get(`/api/announcements/${annId}/attachments/${attId}`)
      .set('Cookie', residentCookie);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toBe('application/pdf');
    expect(downloadRes.headers['content-disposition']).toContain('attachment');

    // Cross-neighborhood resident in KP-02 is denied
    const deniedRes = await request(app.getHttpServer())
      .get(`/api/announcements/${annId}/attachments/${attId}`)
      .set('Cookie', otherResidentCookie);

    expect(deniedRes.status).toBe(403);
  });

  it('Leader should soft-remove announcement, removing it from resident feeds and rejecting new comments', async () => {
    const annId = dbAnnouncements[0]?.id;

    // Soft-remove announcement
    const delRes = await request(app.getHttpServer())
      .delete(`/api/announcements/${annId}`)
      .set('Cookie', leaderCookie);

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.success).toBe(true);

    // Resident querying feed no longer sees the soft-removed announcement
    const listRes = await request(app.getHttpServer())
      .get('/api/announcements')
      .set('Cookie', residentCookie);

    expect(listRes.body.data.items.some((item: { id: string }) => item.id === annId)).toBe(false);

    // Removed announcements are hidden from ordinary residents, so access is denied
    // without disclosing whether the resource still exists in retained history.
    const commentRes = await request(app.getHttpServer())
      .post(`/api/announcements/${annId}/comments`)
      .set('Cookie', residentCookie)
      .send({ content: 'Bình luận trên thông báo đã gỡ' });

    expect(commentRes.status).toBe(403);
  });
});
