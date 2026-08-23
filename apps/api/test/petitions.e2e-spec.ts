import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import {
  Account,
  Neighborhood,
  Petition,
  PetitionEvidence,
  PetitionHistory,
  Notification,
  Prisma,
  Role,
  AccountStatus as DbAccountStatus,
  PetitionStatus as DbPetitionStatus,
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

type DbMockPetition = Petition & {
  neighborhood: Neighborhood | null;
  author: Account;
  evidence: PetitionEvidence[];
  histories: (PetitionHistory & { changedBy: Account })[];
};

describe('Petitions Workflow (e2e)', () => {
  let app: INestApplication;
  let sessionService: SessionService;
  let cryptoService: CryptoService;

  const dbNeighborhoods: Neighborhood[] = [
    {
      id: '99999999-9999-4999-9999-999999999991',
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
      id: '99999999-9999-4999-9999-999999999992',
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
  const dbPetitions: DbMockPetition[] = [];
  const dbEvidences: PetitionEvidence[] = [];
  const dbHistories: (PetitionHistory & { changedBy: Account })[] = [];
  const dbNotifications: Notification[] = [];

  let resident1Cookie: string;
  let resident2Cookie: string;
  let leader1Cookie: string;
  let leader2Cookie: string;
  let officerCookie: string;

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
          if (where?.role) {
            list = list.filter((a) => a.role === where.role);
          }
          if (where?.status) {
            list = list.filter((a) => a.status === where.status);
          }
          if (where?.neighborhoodId) {
            list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
          }
          return list;
        },
        create: async ({ data }: { data: Prisma.AccountUncheckedCreateInput }) => {
          const created: DbMockAccount = {
            id: randomUUID(),
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
      petition: {
        findMany: async ({ where, skip, take }: { where?: Prisma.PetitionWhereInput; skip?: number; take?: number }) => {
          let list = [...dbPetitions];
          if (where?.AND && Array.isArray(where.AND)) {
            for (const cond of where.AND) {
              if (cond.authorId) {
                list = list.filter((p) => p.authorId === cond.authorId);
              }
              if (cond.neighborhoodId) {
                list = list.filter((p) => p.neighborhoodId === cond.neighborhoodId);
              }
              if (cond.status) {
                list = list.filter((p) => p.status === cond.status);
              }
              if (cond.category) {
                list = list.filter((p) => p.category === cond.category);
              }
            }
          }
          if (where?.authorId) {
            list = list.filter((p) => p.authorId === where.authorId);
          }
          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
          }
          if (where?.status) {
            list = list.filter((p) => p.status === where.status);
          }
          const s = skip || 0;
          const t = take || list.length;
          return list.slice(s, s + t);
        },
        findUnique: async ({ where }: { where: Prisma.PetitionWhereUniqueInput }) =>
          dbPetitions.find((p) => p.id === where.id) || null,
        count: async ({ where }: { where?: Prisma.PetitionWhereInput }) => {
          let list = [...dbPetitions];
          if (where?.AND && Array.isArray(where.AND)) {
            for (const cond of where.AND) {
              if (cond.authorId) {
                list = list.filter((p) => p.authorId === cond.authorId);
              }
              if (cond.neighborhoodId) {
                list = list.filter((p) => p.neighborhoodId === cond.neighborhoodId);
              }
              if (cond.status) {
                list = list.filter((p) => p.status === cond.status);
              }
            }
          }
          return list.length;
        },
        create: async ({ data }: { data: Prisma.PetitionUncheckedCreateInput }) => {
          const author = dbAccounts.find((a) => a.id === data.authorId)!;
          const neighborhood = dbNeighborhoods.find((n) => n.id === data.neighborhoodId) || null;
          const created: DbMockPetition = {
            id: randomUUID(),
            title: data.title,
            description: data.description,
            category: data.category,
            status: data.status ?? DbPetitionStatus.reviewing,
            neighborhoodId: data.neighborhoodId,
            authorId: data.authorId,
            responseNote: data.responseNote ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
            author,
            neighborhood,
            evidence: [],
            histories: [],
          };
          dbPetitions.push(created);
          return created;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where?: Prisma.PetitionWhereInput;
          data: Prisma.PetitionUpdateManyMutationInput;
        }) => {
          let count = 0;
          for (const item of dbPetitions) {
            if (where?.id && item.id !== where.id) continue;
            if (where?.status && item.status !== where.status) continue;
            if (where?.authorId && item.authorId !== where.authorId) continue;
            if (where?.neighborhoodId && item.neighborhoodId !== where.neighborhoodId) continue;

            Object.assign(item, data, { updatedAt: new Date() });
            count++;
          }
          return { count };
        },
      },
      petitionEvidence: {
        createMany: async ({ data }: { data: Prisma.PetitionEvidenceCreateManyInput[] }) => {
          for (const item of data) {
            const ev: PetitionEvidence = {
              id: randomUUID(),
              petitionId: item.petitionId,
              fileName: item.fileName,
              originalName: item.originalName,
              mimeType: item.mimeType,
              fileSize: item.fileSize,
              filePath: item.filePath,
              createdAt: new Date(),
            };
            dbEvidences.push(ev);
            const parent = dbPetitions.find((p) => p.id === item.petitionId);
            if (parent) parent.evidence.push(ev);
          }
          return { count: data.length };
        },
        findFirst: async ({ where }: { where?: Prisma.PetitionEvidenceWhereInput }) =>
          dbEvidences.find(
            (e) => e.id === where?.id && e.petitionId === where?.petitionId,
          ) || null,
      },
      petitionHistory: {
        create: async ({ data }: { data: Prisma.PetitionHistoryUncheckedCreateInput }) => {
          const changedBy = dbAccounts.find((a) => a.id === data.changedById)!;
          const hist: PetitionHistory & { changedBy: Account } = {
            id: randomUUID(),
            petitionId: data.petitionId,
            fromStatus: data.fromStatus ?? null,
            toStatus: data.toStatus,
            changedById: data.changedById,
            note: data.note ?? null,
            createdAt: new Date(),
            changedBy,
          };
          dbHistories.push(hist);
          const parent = dbPetitions.find((p) => p.id === data.petitionId);
          if (parent) parent.histories.push(hist);
          return hist;
        },
      },
      notification: {
        create: async ({ data }: { data: Prisma.NotificationUncheckedCreateInput }) => {
          const notif: Notification = {
            id: randomUUID(),
            accountId: data.accountId,
            title: data.title,
            content: data.content,
            type: data.type ?? DbNotificationType.petition,
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
              id: randomUUID(),
              accountId: item.accountId,
              title: item.title,
              content: item.content,
              type: item.type ?? DbNotificationType.petition,
              referenceId: item.referenceId ?? null,
              isRead: item.isRead ?? false,
              readAt: null,
              createdAt: new Date(),
            });
          }
          return { count: data.length };
        },
      },
      pushSubscription: {
        upsert: async () => ({}),
        deleteMany: async () => ({ count: 0 }),
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

    // Create accounts
    const res1 = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('0911111111'),
        phoneHash: cryptoService.hashPhone('0911111111'),
        fullName: 'Cư Dân Khu Phố 1',
        role: Role.resident,
        status: DbAccountStatus.active,
        address: '100 Lê Lợi',
        neighborhoodId: dbNeighborhoods[0]?.id,
      },
    });

    const res2 = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('0922222222'),
        phoneHash: cryptoService.hashPhone('0922222222'),
        fullName: 'Cư Dân Khu Phố 2',
        role: Role.resident,
        status: DbAccountStatus.active,
        address: '200 Hai Bà Trưng',
        neighborhoodId: dbNeighborhoods[1]?.id,
      },
    });

    const lead1 = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('0933333333'),
        phoneHash: cryptoService.hashPhone('0933333333'),
        fullName: 'Trưởng Khu Phố 1',
        role: Role.leader,
        status: DbAccountStatus.active,
        address: '102 Lê Lợi',
        neighborhoodId: dbNeighborhoods[0]?.id,
      },
    });

    const lead2 = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('0944444444'),
        phoneHash: cryptoService.hashPhone('0944444444'),
        fullName: 'Trưởng Khu Phố 2',
        role: Role.leader,
        status: DbAccountStatus.active,
        address: '202 Hai Bà Trưng',
        neighborhoodId: dbNeighborhoods[1]?.id,
      },
    });

    const off = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('0955555555'),
        phoneHash: cryptoService.hashPhone('0955555555'),
        fullName: 'Cán Bộ Phường',
        role: Role.officer,
        status: DbAccountStatus.active,
        address: null,
        neighborhoodId: null,
      },
    });

    // Create sessions
    const s1 = await sessionService.createSession(res1.id, UserRole.RESIDENT, AccountStatus.ACTIVE, dbNeighborhoods[0]?.id ?? null);
    resident1Cookie = `${SESSION_COOKIE_NAME}=${s1}`;

    const s2 = await sessionService.createSession(res2.id, UserRole.RESIDENT, AccountStatus.ACTIVE, dbNeighborhoods[1]?.id ?? null);
    resident2Cookie = `${SESSION_COOKIE_NAME}=${s2}`;

    const sl1 = await sessionService.createSession(lead1.id, UserRole.LEADER, AccountStatus.ACTIVE, dbNeighborhoods[0]?.id ?? null);
    leader1Cookie = `${SESSION_COOKIE_NAME}=${sl1}`;

    const sl2 = await sessionService.createSession(lead2.id, UserRole.LEADER, AccountStatus.ACTIVE, dbNeighborhoods[1]?.id ?? null);
    leader2Cookie = `${SESSION_COOKIE_NAME}=${sl2}`;

    const so = await sessionService.createSession(off.id, UserRole.OFFICER, AccountStatus.ACTIVE, null);
    officerCookie = `${SESSION_COOKIE_NAME}=${so}`;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  let createdPetitionId: string;

  it('Resident 1 should submit a new petition with image evidence successfully', async () => {
    const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    const res = await request(app.getHttpServer())
      .post('/api/petitions')
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .field('title', 'Cống thoát nước bị nghẹt gây ngập')
      .field('description', 'Đoạn đường số 10 ngập nước nặng sau mỗi cơn mưa lớn...')
      .field('category', 'sanitation')
      .attach('files', jpgBuffer, 'drain.jpg');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Cống thoát nước bị nghẹt gây ngập');
    expect(res.body.data.status).toBe('reviewing');
    expect(res.body.data.category).toBe('sanitation');
    expect(res.body.data.evidence.length).toBe(1);
    expect(res.body.data.author.maskedPhone).toContain('***');

    createdPetitionId = res.body.data.id;
  });

  it('Resident 1 should see own petition, while Resident 2 cannot see it', async () => {
    const r1List = await request(app.getHttpServer())
      .get('/api/petitions')
      .set('Cookie', resident1Cookie);

    expect(r1List.status).toBe(200);
    expect(r1List.body.data.items.some((p: { id: string }) => p.id === createdPetitionId)).toBe(true);

    const r2List = await request(app.getHttpServer())
      .get('/api/petitions')
      .set('Cookie', resident2Cookie);

    expect(r2List.status).toBe(200);
    expect(r2List.body.data.items.some((p: { id: string }) => p.id === createdPetitionId)).toBe(false);

    const r2Detail = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}`)
      .set('Cookie', resident2Cookie);

    expect(r2Detail.status).toBe(404);
  });

  it('Leader 1 should see petition in neighborhood, Leader 2 cannot see it', async () => {
    const l1List = await request(app.getHttpServer())
      .get('/api/petitions')
      .set('Cookie', leader1Cookie);

    expect(l1List.status).toBe(200);
    expect(l1List.body.data.items.some((p: { id: string }) => p.id === createdPetitionId)).toBe(true);

    const l2List = await request(app.getHttpServer())
      .get('/api/petitions')
      .set('Cookie', leader2Cookie);

    expect(l2List.status).toBe(200);
    expect(l2List.body.data.items.some((p: { id: string }) => p.id === createdPetitionId)).toBe(false);

    const l2Detail = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}`)
      .set('Cookie', leader2Cookie);

    expect(l2Detail.status).toBe(404);
  });

  it('Leader 1 should transition petition from reviewing to processing', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/petitions/${createdPetitionId}/status`)
      .set('Cookie', leader1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        status: 'processing',
        responseNote: 'Đã báo đơn vị thoát nước đô thị',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('processing');
    expect(res.body.data.history.length).toBeGreaterThanOrEqual(2);
  });

  it('Resident 1 cannot cancel petition once it is in processing state', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/petitions/${createdPetitionId}/cancel`)
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ reason: 'Hủy' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('Leader 1 should transition petition from processing to resolved', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/petitions/${createdPetitionId}/status`)
      .set('Cookie', leader1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        status: 'resolved',
        responseNote: 'Đã nạo vét cống rãnh hoàn tất',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('resolved');
  });

  it('Officer should view petition details and timeline ward-wide', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}`)
      .set('Cookie', officerCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdPetitionId);
    expect(res.body.data.history.length).toBeGreaterThanOrEqual(3);
  });

  it('Resident 1 can create another petition and cancel it while in reviewing state', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/petitions')
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .field('title', 'Đèn đường hỏng')
      .field('description', 'Bóng đèn đường trước ngõ bị cháy')
      .field('category', 'infrastructure');

    expect(createRes.status).toBe(201);
    const pet2Id = createRes.body.data.id;

    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${pet2Id}/cancel`)
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ reason: 'Ban quản lý đã thay bóng đèn' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');
  });

  it('should reject malformed UUID route parameter with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/petitions/invalid-uuid-123')
      .set('Cookie', resident1Cookie);

    expect(res.status).toBe(400);
  });

  it('should reject whitespace-only title with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/petitions')
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .field('title', '   ')
      .field('description', 'Valid description')
      .field('category', 'infrastructure');

    expect(res.status).toBe(400);
  });

  it('should reject cookie-authenticated mutation without a trusted origin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/petitions')
      .set('Cookie', resident1Cookie)
      .field('title', 'Yêu cầu không có Origin')
      .field('description', 'Kiểm tra lớp bảo vệ CSRF')
      .field('category', 'other');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should reject inverted date range query with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/petitions?startDate=2026-08-25&endDate=2026-08-20')
      .set('Cookie', resident1Cookie);

    expect(res.status).toBe(400);
  });
});
