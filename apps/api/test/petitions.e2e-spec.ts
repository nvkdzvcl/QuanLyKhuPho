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
  PetitionCategory as DbPetitionCategory,
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

type PetitionWhereClause = {
  authorId?: string;
  neighborhoodId?: string | null;
  status?: DbPetitionStatus;
  category?: DbPetitionCategory;
  createdAt?: { gte?: Date; lte?: Date };
  AND?: PetitionWhereClause | PetitionWhereClause[];
  OR?: Array<{
    title?: { contains?: string; mode?: string };
    description?: { contains?: string; mode?: string };
  }>;
};

function matchesPetitionWhere(
  petition: DbMockPetition,
  where?: PetitionWhereClause,
): boolean {
  if (!where) return true;

  if (where.AND) {
    const andConditions = Array.isArray(where.AND) ? where.AND : [where.AND];
    if (!andConditions.every((condition) => matchesPetitionWhere(petition, condition))) {
      return false;
    }
  }

  if (where.OR) {
    const orMatches = where.OR.some((orCond) => {
      const searchTitle = orCond.title?.contains?.toLowerCase();
      if (searchTitle && petition.title.toLowerCase().includes(searchTitle)) {
        return true;
      }
      const searchDesc = orCond.description?.contains?.toLowerCase();
      if (searchDesc && petition.description.toLowerCase().includes(searchDesc)) {
        return true;
      }
      return false;
    });
    if (!orMatches) return false;
  }

  if (where.authorId && petition.authorId !== where.authorId) return false;
  if (where.neighborhoodId !== undefined && petition.neighborhoodId !== where.neighborhoodId) return false;
  if (where.status && petition.status !== where.status) return false;
  if (where.category && petition.category !== where.category) return false;
  if (where.createdAt) {
    if (where.createdAt.gte && petition.createdAt < where.createdAt.gte) return false;
    if (where.createdAt.lte && petition.createdAt > where.createdAt.lte) return false;
  }

  return true;
}

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
        findMany: async ({
          where,
          orderBy,
          skip = 0,
          take,
        }: {
          where?: Prisma.PetitionWhereInput;
          orderBy?: Prisma.PetitionOrderByWithRelationInput;
          skip?: number;
          take?: number;
        }) => {
          const clause = where as PetitionWhereClause | undefined;
          const list = dbPetitions
            .filter((p) => matchesPetitionWhere(p, clause))
            .sort((left, right) =>
              orderBy?.createdAt === 'desc'
                ? right.createdAt.getTime() - left.createdAt.getTime()
                : left.createdAt.getTime() - right.createdAt.getTime(),
            );
          return list.slice(skip, take === undefined ? undefined : skip + take);
        },
        findUnique: async ({ where }: { where: Prisma.PetitionWhereUniqueInput }) =>
          dbPetitions.find((p) => p.id === where.id) || null,
        count: async ({ where }: { where?: Prisma.PetitionWhereInput }) =>
          dbPetitions.filter((p) =>
            matchesPetitionWhere(p, where as PetitionWhereClause | undefined),
          ).length,
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
            (e) =>
              (!where?.id || e.id === where.id) &&
              (!where?.petitionId || e.petitionId === where.petitionId),
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
        findMany: async ({ where }: { where?: Prisma.NotificationWhereInput }) =>
          dbNotifications.filter((n) => {
            if (where?.accountId && n.accountId !== where.accountId) return false;
            if (where?.referenceId && n.referenceId !== where.referenceId) return false;
            return true;
          }),
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
    const s1 = await sessionService.createSession(
      res1.id,
      UserRole.RESIDENT,
      AccountStatus.ACTIVE,
      dbNeighborhoods[0]?.id ?? null,
    );
    resident1Cookie = `${SESSION_COOKIE_NAME}=${s1}`;

    const s2 = await sessionService.createSession(
      res2.id,
      UserRole.RESIDENT,
      AccountStatus.ACTIVE,
      dbNeighborhoods[1]?.id ?? null,
    );
    resident2Cookie = `${SESSION_COOKIE_NAME}=${s2}`;

    const sl1 = await sessionService.createSession(
      lead1.id,
      UserRole.LEADER,
      AccountStatus.ACTIVE,
      dbNeighborhoods[0]?.id ?? null,
    );
    leader1Cookie = `${SESSION_COOKIE_NAME}=${sl1}`;

    const sl2 = await sessionService.createSession(
      lead2.id,
      UserRole.LEADER,
      AccountStatus.ACTIVE,
      dbNeighborhoods[1]?.id ?? null,
    );
    leader2Cookie = `${SESSION_COOKIE_NAME}=${sl2}`;

    const so = await sessionService.createSession(
      off.id,
      UserRole.OFFICER,
      AccountStatus.ACTIVE,
      null,
    );
    officerCookie = `${SESSION_COOKIE_NAME}=${so}`;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  let createdPetitionId: string;
  let createdEvidenceId: string;

  it('Resident 1 should submit a new petition with image evidence successfully (FR-12)', async () => {
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
    createdEvidenceId = res.body.data.evidence[0].id;

    // Verify durable in-app notification created for Leader 1
    const leader1Notif = dbNotifications.find(
      (n) => n.referenceId === createdPetitionId,
    );
    expect(leader1Notif).toBeDefined();
    expect(leader1Notif?.title).toContain('Kiến nghị mới trong khu phố');
  });

  it('Resident 1 should see own petition, while Resident 2 cannot see it (FR-16)', async () => {
    const r1List = await request(app.getHttpServer())
      .get('/api/petitions')
      .set('Cookie', resident1Cookie);

    expect(r1List.status).toBe(200);
    expect(
      r1List.body.data.items.some((p: { id: string }) => p.id === createdPetitionId),
    ).toBe(true);

    const r2List = await request(app.getHttpServer())
      .get('/api/petitions')
      .set('Cookie', resident2Cookie);

    expect(r2List.status).toBe(200);
    expect(
      r2List.body.data.items.some((p: { id: string }) => p.id === createdPetitionId),
    ).toBe(false);

    const r2Detail = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}`)
      .set('Cookie', resident2Cookie);

    expect(r2Detail.status).toBe(404);
  });

  it('Leader 1 should see petition in neighborhood, Leader 2 cannot see it (FR-13)', async () => {
    const l1List = await request(app.getHttpServer())
      .get('/api/petitions')
      .set('Cookie', leader1Cookie);

    expect(l1List.status).toBe(200);
    expect(
      l1List.body.data.items.some((p: { id: string }) => p.id === createdPetitionId),
    ).toBe(true);

    const l2List = await request(app.getHttpServer())
      .get('/api/petitions')
      .set('Cookie', leader2Cookie);

    expect(l2List.status).toBe(200);
    expect(
      l2List.body.data.items.some((p: { id: string }) => p.id === createdPetitionId),
    ).toBe(false);

    const l2Detail = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}`)
      .set('Cookie', leader2Cookie);

    expect(l2Detail.status).toBe(404);
  });

  it('Evidence download endpoint should serve image with inline disposition and enforce role/neighborhood scope (supporting FR-12 through FR-16)', async () => {
    // 1. Author Resident 1 downloads evidence
    const r1Download = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}/evidence/${createdEvidenceId}`)
      .set('Cookie', resident1Cookie);

    expect(r1Download.status).toBe(200);
    expect(r1Download.headers['content-type']).toBe('image/jpeg');
    expect(r1Download.headers['content-disposition']).toContain('inline');
    expect(r1Download.headers['content-disposition']).toContain('drain.jpg');

    // 2. Cross-neighborhood Resident 2 is forbidden (404 NOT FOUND to avoid disclosure)
    const r2Download = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}/evidence/${createdEvidenceId}`)
      .set('Cookie', resident2Cookie);

    expect(r2Download.status).toBe(404);

    // 3. Leader 1 (assigned neighborhood) downloads evidence
    const l1Download = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}/evidence/${createdEvidenceId}`)
      .set('Cookie', leader1Cookie);

    expect(l1Download.status).toBe(200);

    // 4. Leader 2 (different neighborhood) receives 404
    const l2Download = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}/evidence/${createdEvidenceId}`)
      .set('Cookie', leader2Cookie);

    expect(l2Download.status).toBe(404);

    // 5. Officer downloads evidence ward-wide
    const offDownload = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}/evidence/${createdEvidenceId}`)
      .set('Cookie', officerCookie);

    expect(offDownload.status).toBe(200);

    // 6. Non-existent evidence ID returns 404
    const nonExistentEvId = '00000000-0000-4000-0000-000000000000';
    const nonExistentDownload = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}/evidence/${nonExistentEvId}`)
      .set('Cookie', resident1Cookie);

    expect(nonExistentDownload.status).toBe(404);
  });

  it('List query filters, search, and pagination should work accurately across roles (FR-13 & FR-16)', async () => {
    // 1. Status filter
    const reviewingList = await request(app.getHttpServer())
      .get('/api/petitions?status=reviewing')
      .set('Cookie', resident1Cookie);

    expect(reviewingList.status).toBe(200);
    expect(reviewingList.body.data.items.length).toBeGreaterThanOrEqual(1);

    const resolvedList = await request(app.getHttpServer())
      .get('/api/petitions?status=resolved')
      .set('Cookie', resident1Cookie);

    expect(resolvedList.status).toBe(200);
    expect(resolvedList.body.data.items.length).toBe(0);

    // 2. Category filter
    const sanitationList = await request(app.getHttpServer())
      .get('/api/petitions?category=sanitation')
      .set('Cookie', resident1Cookie);

    expect(sanitationList.status).toBe(200);
    expect(sanitationList.body.data.items.length).toBeGreaterThanOrEqual(1);

    const securityList = await request(app.getHttpServer())
      .get('/api/petitions?category=security')
      .set('Cookie', resident1Cookie);

    expect(securityList.status).toBe(200);
    expect(securityList.body.data.items.length).toBe(0);

    // 3. Search query
    const searchMatch = await request(app.getHttpServer())
      .get('/api/petitions?search=thoát+nước')
      .set('Cookie', resident1Cookie);

    expect(searchMatch.status).toBe(200);
    expect(searchMatch.body.data.items.length).toBeGreaterThanOrEqual(1);

    const searchNoMatch = await request(app.getHttpServer())
      .get('/api/petitions?search=khongtontai12345')
      .set('Cookie', resident1Cookie);

    expect(searchNoMatch.status).toBe(200);
    expect(searchNoMatch.body.data.items.length).toBe(0);

    // 4. Date range query
    const dateRangeList = await request(app.getHttpServer())
      .get('/api/petitions?startDate=2026-01-01&endDate=2026-12-31')
      .set('Cookie', resident1Cookie);

    expect(dateRangeList.status).toBe(200);
    expect(dateRangeList.body.data.items.length).toBeGreaterThanOrEqual(1);

    // 5. Pagination structure
    const pageRes = await request(app.getHttpServer())
      .get('/api/petitions?page=1&limit=1')
      .set('Cookie', resident1Cookie);

    expect(pageRes.status).toBe(200);
    expect(pageRes.body.data.page).toBe(1);
    expect(pageRes.body.data.limit).toBe(1);
    expect(pageRes.body.data.total).toBeGreaterThanOrEqual(1);
    expect(pageRes.body.data.totalPages).toBeGreaterThanOrEqual(1);
    expect(pageRes.body.data.items.length).toBe(1);

    // 6. Officer neighborhood filter vs ward-wide query
    const offKp1 = await request(app.getHttpServer())
      .get(`/api/petitions?neighborhoodId=${dbNeighborhoods[0]?.id}`)
      .set('Cookie', officerCookie);

    expect(offKp1.status).toBe(200);
    expect(
      offKp1.body.data.items.some((p: { id: string }) => p.id === createdPetitionId),
    ).toBe(true);

    const offKp2 = await request(app.getHttpServer())
      .get(`/api/petitions?neighborhoodId=${dbNeighborhoods[1]?.id}`)
      .set('Cookie', officerCookie);

    expect(offKp2.status).toBe(200);
    expect(
      offKp2.body.data.items.some((p: { id: string }) => p.id === createdPetitionId),
    ).toBe(false);
  });

  it('Leader 1 should transition petition from reviewing to processing (FR-14)', async () => {
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

    // Verify durable in-app notification created for author Resident 1
    const authorNotif = dbNotifications.find(
      (n) =>
        n.referenceId === createdPetitionId &&
        n.title.includes('Đang xử lý'),
    );
    expect(authorNotif).toBeDefined();
  });

  it('Resident 1 cannot cancel petition once it is in processing state (FR-15)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/petitions/${createdPetitionId}/cancel`)
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ reason: 'Hủy' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('Resident 2 should submit petition in KP2, and Leader 2 should reject it with required note (FR-14)', async () => {
    // 1. Resident 2 submits petition in KP2
    const createRes = await request(app.getHttpServer())
      .post('/api/petitions')
      .set('Cookie', resident2Cookie)
      .set('Origin', 'http://localhost:3000')
      .field('title', 'Tụ tập gây mất trật tự ban đêm')
      .field('description', 'Khu vực ngã ba thường xuyên có thanh niên tụ tập nẹt pô')
      .field('category', 'security');

    expect(createRes.status).toBe(201);
    const pet2Id = createRes.body.data.id;

    // 2. Leader 2 transitions reviewing -> processing
    const procRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${pet2Id}/status`)
      .set('Cookie', leader2Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ status: 'processing' });

    expect(procRes.status).toBe(200);

    // 3. Leader 2 attempts rejection without note -> 400 Bad Request
    const emptyRejectRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${pet2Id}/status`)
      .set('Cookie', leader2Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ status: 'rejected', responseNote: '   ' });

    expect(emptyRejectRes.status).toBe(400);

    // 4. Leader 2 rejects with valid note -> 200 OK
    const rejectRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${pet2Id}/status`)
      .set('Cookie', leader2Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        status: 'rejected',
        responseNote: 'Đã chuyển hồ sơ sang công an phường xử lý vi phạm giao thông',
      });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('rejected');
    expect(rejectRes.body.data.responseNote).toBe(
      'Đã chuyển hồ sơ sang công an phường xử lý vi phạm giao thông',
    );

    // 5. Verify durable notification created for Resident 2
    const rejectNotif = dbNotifications.find(
      (n) => n.referenceId === pet2Id && n.title.includes('Bị từ chối'),
    );
    expect(rejectNotif).toBeDefined();

    // 6. Transition on rejected petition is forbidden
    const reProcRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${pet2Id}/status`)
      .set('Cookie', leader2Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ status: 'processing' });

    expect(reProcRes.status).toBe(400);
  });

  it('Cross-role status transition restrictions and invalid state transitions (FR-14)', async () => {
    // 1. Resident cannot update status (403)
    const residentStatusRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${createdPetitionId}/status`)
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ status: 'resolved' });

    expect(residentStatusRes.status).toBe(403);

    // 2. Leader 2 cannot update Leader 1's petition (403)
    const crossLeaderRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${createdPetitionId}/status`)
      .set('Cookie', leader2Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ status: 'resolved' });

    expect(crossLeaderRes.status).toBe(403);
  });

  it('Leader 1 should transition petition from processing to resolved (FR-14)', async () => {
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

    // Terminal state cannot transition again
    const postResolvedRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${createdPetitionId}/status`)
      .set('Cookie', leader1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ status: 'processing' });

    expect(postResolvedRes.status).toBe(400);
  });

  it('Officer should view petition details and timeline ward-wide (FR-13 & FR-14)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/petitions/${createdPetitionId}`)
      .set('Cookie', officerCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdPetitionId);
    expect(res.body.data.history.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.history[0].toStatus).toBe('reviewing');
    expect(res.body.data.history[1].toStatus).toBe('processing');
    expect(res.body.data.history[2].toStatus).toBe('resolved');
  });

  it('Resident 1 can create another petition and cancel it while in reviewing state (FR-15)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/petitions')
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .field('title', 'Đèn đường hỏng')
      .field('description', 'Bóng đèn đường trước ngõ bị cháy')
      .field('category', 'infrastructure');

    expect(createRes.status).toBe(201);
    const petCancelId = createRes.body.data.id;

    // Non-author Resident 2 cannot cancel (404)
    const r2CancelRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${petCancelId}/cancel`)
      .set('Cookie', resident2Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ reason: 'Hủy trái phép' });

    expect(r2CancelRes.status).toBe(404);

    // Leader cannot cancel (403)
    const leaderCancelRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${petCancelId}/cancel`)
      .set('Cookie', leader1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ reason: 'Trưởng KP hủy' });

    expect(leaderCancelRes.status).toBe(403);

    // Officer cannot cancel (403)
    const officerCancelRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${petCancelId}/cancel`)
      .set('Cookie', officerCookie)
      .set('Origin', 'http://localhost:3000')
      .send({ reason: 'Cán bộ hủy' });

    expect(officerCancelRes.status).toBe(403);

    // Author Resident 1 cancels successfully
    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${petCancelId}/cancel`)
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ reason: 'Ban quản lý đã thay bóng đèn' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');
    expect(cancelRes.body.data.responseNote).toBe('Ban quản lý đã thay bóng đèn');

    // Cancelling an already cancelled petition fails
    const reCancelRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${petCancelId}/cancel`)
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ reason: 'Hủy lại' });

    expect(reCancelRes.status).toBe(400);
  });

  it('Officer can process and resolve petitions across any neighborhood (FR-14)', async () => {
    // 1. Resident 1 creates petition 3 in KP1
    const createRes = await request(app.getHttpServer())
      .post('/api/petitions')
      .set('Cookie', resident1Cookie)
      .set('Origin', 'http://localhost:3000')
      .field('title', 'Cây xanh nghiêng nguy hiểm')
      .field('description', 'Cây xà cừ trước số nhà 50 có nguy cơ gãy đổ')
      .field('category', 'infrastructure');

    expect(createRes.status).toBe(201);
    const pet3Id = createRes.body.data.id;

    // 2. Officer transitions reviewing -> processing
    const procRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${pet3Id}/status`)
      .set('Cookie', officerCookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        status: 'processing',
        responseNote: 'UBND phường đã cử công ty cây xanh khảo sát',
      });

    expect(procRes.status).toBe(200);
    expect(procRes.body.data.status).toBe('processing');

    // 3. Officer transitions processing -> resolved
    const resolveRes = await request(app.getHttpServer())
      .patch(`/api/petitions/${pet3Id}/status`)
      .set('Cookie', officerCookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        status: 'resolved',
        responseNote: 'Đã hoàn tất tỉa cành và gia cố cây xanh an toàn',
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('resolved');
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
