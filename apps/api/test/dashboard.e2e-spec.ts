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
  Announcement,
  Petition,
  Prisma,
  Role,
  AccountStatus as DbAccountStatus,
  AnnouncementScope as DbAnnouncementScope,
  AnnouncementStatus as DbAnnouncementStatus,
  PetitionCategory as DbPetitionCategory,
  PetitionStatus as DbPetitionStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CryptoService } from '../src/security/crypto.service';
import { SessionService } from '../src/auth/session.service';
import { HttpExceptionFilter } from '../src/core/exceptions/http-exception.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';
import { SESSION_COOKIE_NAME } from '../src/core/constants';
import {
  AccountStatus,
  ErrorCode,
  NeighborhoodDetailSummaryDto,
  PeriodicReportResponseDto,
  PetitionCategory,
  PetitionCategoryAnalyticsResponseDto,
  ReportingPeriodType,
  UserRole,
  WardOverviewDto,
} from '@quanlykhupho/shared-types';

type DbMockAccount = Account & {
  neighborhood: Neighborhood | null;
};

type DbMockAnnouncement = Announcement & {
  neighborhood: Neighborhood | null;
  author: Account;
};

type DbMockPetition = Petition & {
  neighborhood: Neighborhood | null;
  author: Account;
};

type GroupRecord = Record<string, unknown> & {
  _count: { id: number };
};

describe('Officer Dashboard API (e2e)', () => {
  let app: INestApplication;
  let sessionService: SessionService;
  let cryptoService: CryptoService;

  const n1Id = '99999999-9999-4999-9999-999999999991';
  const n2Id = '99999999-9999-4999-9999-999999999992';

  const dbNeighborhoods: Neighborhood[] = [
    {
      id: n1Id,
      code: 'KP-01',
      name: 'Khu phố 1',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
      description: 'Khu phố trung tâm 1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: n2Id,
      code: 'KP-02',
      name: 'Khu phố 2',
      ward: 'Phường Bến Nghé',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
      description: 'Khu phố ven sông 2',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  const dbAccounts: DbMockAccount[] = [];
  const dbAnnouncements: DbMockAnnouncement[] = [];
  const dbPetitions: DbMockPetition[] = [];

  let residentCookie: string;
  let leaderCookie: string;
  let officerCookie: string;

  beforeAll(async () => {
    const mockPrisma = {
      $connect: async () => {},
      $disconnect: async () => {},
      $transaction: async <T>(
        cb: (tx: PrismaService) => Promise<T>,
      ): Promise<T> => cb(mockPrisma as unknown as PrismaService),
      neighborhood: {
        findMany: async () => dbNeighborhoods,
        findUnique: async ({
          where,
        }: {
          where: Prisma.NeighborhoodWhereUniqueInput;
        }) => dbNeighborhoods.find((n) => n.id === where.id) || null,
      },
      account: {
        findUnique: async ({
          where,
        }: {
          where: Prisma.AccountWhereUniqueInput;
        }) =>
          dbAccounts.find(
            (a) => a.id === where.id || a.phoneHash === where.phoneHash,
          ) || null,
        count: async ({ where }: { where?: Prisma.AccountWhereInput }) => {
          let list = [...dbAccounts];
          if (where?.role) {
            list = list.filter((a) => a.role === where.role);
          }
          if (where?.status) {
            list = list.filter((a) => a.status === where.status);
          }
          if (where?.neighborhoodId) {
            if (
              typeof where.neighborhoodId === 'object' &&
              'not' in where.neighborhoodId
            ) {
              list = list.filter((a) => a.neighborhoodId !== null);
            } else if (typeof where.neighborhoodId === 'string') {
              list = list.filter(
                (a) => a.neighborhoodId === where.neighborhoodId,
              );
            }
          }
          if (where?.createdAt) {
            const dateFilter = where.createdAt;
            const gte =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.gte instanceof Date
                ? dateFilter.gte
                : undefined;
            const lt =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.lt instanceof Date
                ? dateFilter.lt
                : undefined;
            if (gte) {
              list = list.filter((a) => new Date(a.createdAt) >= gte);
            }
            if (lt) {
              list = list.filter((a) => new Date(a.createdAt) < lt);
            }
          }
          return list.length;
        },
        groupBy: async ({
          by,
          where,
        }: {
          by: string[];
          where?: Prisma.AccountWhereInput;
        }) => {
          let list = [...dbAccounts];
          if (where?.role) {
            list = list.filter((a) => a.role === where.role);
          }
          if (where?.neighborhoodId) {
            if (
              typeof where.neighborhoodId === 'object' &&
              'not' in where.neighborhoodId
            ) {
              list = list.filter((a) => a.neighborhoodId !== null);
            } else if (typeof where.neighborhoodId === 'string') {
              list = list.filter(
                (a) => a.neighborhoodId === where.neighborhoodId,
              );
            }
          }
          if (where?.status) {
            list = list.filter((a) => a.status === where.status);
          }
          if (where?.createdAt) {
            const dateFilter = where.createdAt;
            const gte =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.gte instanceof Date
                ? dateFilter.gte
                : undefined;
            const lt =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.lt instanceof Date
                ? dateFilter.lt
                : undefined;
            if (gte) {
              list = list.filter((a) => new Date(a.createdAt) >= gte);
            }
            if (lt) {
              list = list.filter((a) => new Date(a.createdAt) < lt);
            }
          }

          const map = new Map<string, GroupRecord>();
          for (const item of list) {
            const keyParts: string[] = [];
            const resObj: GroupRecord = { _count: { id: 0 } };
            const itemRecord = item as unknown as Record<string, unknown>;
            for (const b of by) {
              const val = itemRecord[b];
              keyParts.push(`${b}:${val}`);
              resObj[b] = val;
            }
            const key = keyParts.join('|');
            if (!map.has(key)) {
              map.set(key, resObj);
            }
            map.get(key)!._count.id++;
          }
          return Array.from(map.values());
        },
      },
      announcement: {
        count: async ({ where }: { where?: Prisma.AnnouncementWhereInput }) => {
          let list = [...dbAnnouncements];
          if (where?.status) {
            list = list.filter((a) => a.status === where.status);
          }
          if (where?.neighborhoodId) {
            list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
          }
          if (where?.createdAt) {
            const dateFilter = where.createdAt;
            const gte =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.gte instanceof Date
                ? dateFilter.gte
                : undefined;
            const lte =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.lte instanceof Date
                ? dateFilter.lte
                : undefined;
            const lt =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.lt instanceof Date
                ? dateFilter.lt
                : undefined;
            if (gte) {
              list = list.filter((a) => new Date(a.createdAt) >= gte);
            }
            if (lte) {
              list = list.filter((a) => new Date(a.createdAt) <= lte);
            }
            if (lt) {
              list = list.filter((a) => new Date(a.createdAt) < lt);
            }
          }
          return list.length;
        },
        groupBy: async ({
          by,
          where,
        }: {
          by: string[];
          where?: Prisma.AnnouncementWhereInput;
        }) => {
          let list = [...dbAnnouncements];
          if (where?.status) {
            list = list.filter((a) => a.status === where.status);
          }
          if (where?.neighborhoodId) {
            if (
              typeof where.neighborhoodId === 'object' &&
              'not' in where.neighborhoodId
            ) {
              list = list.filter((a) => a.neighborhoodId !== null);
            } else if (typeof where.neighborhoodId === 'string') {
              list = list.filter(
                (a) => a.neighborhoodId === where.neighborhoodId,
              );
            }
          }
          if (where?.createdAt) {
            const dateFilter = where.createdAt;
            const gte =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.gte instanceof Date
                ? dateFilter.gte
                : undefined;
            const lt =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.lt instanceof Date
                ? dateFilter.lt
                : undefined;
            if (gte) {
              list = list.filter((a) => new Date(a.createdAt) >= gte);
            }
            if (lt) {
              list = list.filter((a) => new Date(a.createdAt) < lt);
            }
          }
          const map = new Map<string, GroupRecord>();
          for (const item of list) {
            const keyParts: string[] = [];
            const resObj: GroupRecord = { _count: { id: 0 } };
            const itemRecord = item as unknown as Record<string, unknown>;
            for (const b of by) {
              const val = itemRecord[b];
              keyParts.push(`${b}:${val}`);
              resObj[b] = val;
            }
            const key = keyParts.join('|');
            if (!map.has(key)) {
              map.set(key, resObj);
            }
            map.get(key)!._count.id++;
          }
          return Array.from(map.values());
        },
        findMany: async ({
          where,
          orderBy: _orderBy,
          take,
        }: {
          where?: Prisma.AnnouncementWhereInput;
          orderBy?: Prisma.AnnouncementOrderByWithRelationInput;
          take?: number;
        }) => {
          let list = [...dbAnnouncements];
          if (where?.status) {
            list = list.filter((a) => a.status === where.status);
          }
          if (where?.neighborhoodId) {
            list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
          }
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          if (take) {
            list = list.slice(0, take);
          }
          return list;
        },
      },
      petition: {
        groupBy: async ({
          by,
          where,
        }: {
          by: string[];
          where?: Prisma.PetitionWhereInput;
        }) => {
          let list = [...dbPetitions];
          if (where?.neighborhoodId) {
            if (
              typeof where.neighborhoodId === 'object' &&
              'not' in where.neighborhoodId
            ) {
              list = list.filter((p) => p.neighborhoodId !== null);
            } else if (typeof where.neighborhoodId === 'string') {
              list = list.filter(
                (p) => p.neighborhoodId === where.neighborhoodId,
              );
            }
          }
          if (where?.status) {
            list = list.filter((p) => p.status === where.status);
          }
          if (where?.category) {
            list = list.filter((p) => p.category === where.category);
          }
          if (where?.createdAt) {
            const dateFilter = where.createdAt;
            const gte =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.gte instanceof Date
                ? dateFilter.gte
                : undefined;
            const lte =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.lte instanceof Date
                ? dateFilter.lte
                : undefined;
            const lt =
              typeof dateFilter === 'object' &&
              !(dateFilter instanceof Date) &&
              dateFilter.lt instanceof Date
                ? dateFilter.lt
                : undefined;
            if (gte) {
              list = list.filter((p) => new Date(p.createdAt) >= gte);
            }
            if (lte) {
              list = list.filter((p) => new Date(p.createdAt) <= lte);
            }
            if (lt) {
              list = list.filter((p) => new Date(p.createdAt) < lt);
            }
          }

          const map = new Map<string, GroupRecord>();
          for (const item of list) {
            const keyParts: string[] = [];
            const resObj: GroupRecord = { _count: { id: 0 } };
            const itemRecord = item as unknown as Record<string, unknown>;
            for (const b of by) {
              const val = itemRecord[b];
              keyParts.push(`${b}:${val}`);
              resObj[b] = val;
            }
            const key = keyParts.join('|');
            if (!map.has(key)) {
              map.set(key, resObj);
            }
            map.get(key)!._count.id++;
          }
          return Array.from(map.values());
        },
        findMany: async ({
          where,
          orderBy: _orderBy,
          take,
        }: {
          where?: Prisma.PetitionWhereInput;
          orderBy?: Prisma.PetitionOrderByWithRelationInput;
          take?: number;
        }) => {
          let list = [...dbPetitions];
          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
          }
          if (where?.status) {
            list = list.filter((p) => p.status === where.status);
          }
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          if (take) {
            list = list.slice(0, take);
          }
          return list;
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
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    sessionService = app.get(SessionService);
    cryptoService = app.get(CryptoService);

    // 1. Seed Accounts
    const residentAcc: DbMockAccount = {
      id: randomUUID(),
      phoneEncrypted: cryptoService.encrypt('0901111111'),
      phoneHash: cryptoService.hashPhone('0901111111'),
      fullName: 'Nguyễn Văn Cư Dân 1',
      role: Role.resident,
      status: DbAccountStatus.active,
      address: '10 Lê Lợi',
      neighborhoodId: n1Id,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      neighborhood: dbNeighborhoods[0]!,
    };
    dbAccounts.push(residentAcc);

    const residentPendingAcc: DbMockAccount = {
      id: randomUUID(),
      phoneEncrypted: cryptoService.encrypt('0902222222'),
      phoneHash: cryptoService.hashPhone('0902222222'),
      fullName: 'Trần Cư Dân 2 (Pending)',
      role: Role.resident,
      status: DbAccountStatus.pending,
      address: '20 Nguyễn Huệ',
      neighborhoodId: n1Id,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date('2026-08-05T00:00:00Z'),
      updatedAt: new Date('2026-08-05T00:00:00Z'),
      neighborhood: dbNeighborhoods[0]!,
    };
    dbAccounts.push(residentPendingAcc);

    const residentN2Acc: DbMockAccount = {
      id: randomUUID(),
      phoneEncrypted: cryptoService.encrypt('0903333333'),
      phoneHash: cryptoService.hashPhone('0903333333'),
      fullName: 'Lê Cư Dân KP2',
      role: Role.resident,
      status: DbAccountStatus.active,
      address: '30 Pasteur',
      neighborhoodId: n2Id,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date('2026-08-06T00:00:00Z'),
      updatedAt: new Date('2026-08-06T00:00:00Z'),
      neighborhood: dbNeighborhoods[1]!,
    };
    dbAccounts.push(residentN2Acc);

    const leaderAcc: DbMockAccount = {
      id: randomUUID(),
      phoneEncrypted: cryptoService.encrypt('0911111111'),
      phoneHash: cryptoService.hashPhone('0911111111'),
      fullName: 'Trần Văn Trưởng KP1',
      role: Role.leader,
      status: DbAccountStatus.active,
      address: '15 Lê Lợi',
      neighborhoodId: n1Id,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      neighborhood: dbNeighborhoods[0]!,
    };
    dbAccounts.push(leaderAcc);

    const officerAcc: DbMockAccount = {
      id: randomUUID(),
      phoneEncrypted: cryptoService.encrypt('0988888888'),
      phoneHash: cryptoService.hashPhone('0988888888'),
      fullName: 'Phạm Cán Bộ Phường',
      role: Role.officer,
      status: DbAccountStatus.active,
      address: 'UBND Phường Bến Nghé',
      neighborhoodId: null,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      neighborhood: null,
    };
    dbAccounts.push(officerAcc);

    // 2. Seed Announcements
    const now = new Date();
    const ann1: DbMockAnnouncement = {
      id: randomUUID(),
      title: 'Thông báo họp tổ dân phố tháng 8',
      content: 'Nội dung thông báo...',
      scope: DbAnnouncementScope.neighborhood,
      status: DbAnnouncementStatus.published,
      neighborhoodId: n1Id,
      authorId: leaderAcc.id,
      createdAt: now,
      updatedAt: now,
      neighborhood: dbNeighborhoods[0]!,
      author: leaderAcc,
    };
    dbAnnouncements.push(ann1);

    const annOld: DbMockAnnouncement = {
      id: randomUUID(),
      title: 'Thông báo tháng 5',
      content: 'Nội dung thông báo cũ...',
      scope: DbAnnouncementScope.neighborhood,
      status: DbAnnouncementStatus.published,
      neighborhoodId: n1Id,
      authorId: leaderAcc.id,
      createdAt: new Date('2026-05-10T10:00:00Z'),
      updatedAt: new Date('2026-05-10T10:00:00Z'),
      neighborhood: dbNeighborhoods[0]!,
      author: leaderAcc,
    };
    dbAnnouncements.push(annOld);

    const annRemoved: DbMockAnnouncement = {
      id: randomUUID(),
      title: 'Thông báo bị gỡ',
      content: 'Nội dung thông báo đã bị gỡ...',
      scope: DbAnnouncementScope.neighborhood,
      status: DbAnnouncementStatus.removed,
      neighborhoodId: n1Id,
      authorId: leaderAcc.id,
      createdAt: now,
      updatedAt: now,
      neighborhood: dbNeighborhoods[0]!,
      author: leaderAcc,
    };
    dbAnnouncements.push(annRemoved);

    // 3. Seed Petitions
    const pet1: DbMockPetition = {
      id: randomUUID(),
      title: 'Hỏng cống thoát nước',
      description: 'Cống bị nghẹt...',
      category: DbPetitionCategory.sanitation,
      status: DbPetitionStatus.reviewing,
      neighborhoodId: n1Id,
      authorId: residentAcc.id,
      responseNote: null,
      createdAt: new Date('2026-08-10T10:00:00Z'),
      updatedAt: new Date('2026-08-10T10:00:00Z'),
      neighborhood: dbNeighborhoods[0]!,
      author: residentAcc,
    };
    dbPetitions.push(pet1);

    const pet2: DbMockPetition = {
      id: randomUUID(),
      title: 'Hư hỏng mặt đường hẻm',
      description: 'Đường bị sụt lún...',
      category: DbPetitionCategory.infrastructure,
      status: DbPetitionStatus.resolved,
      neighborhoodId: n1Id,
      authorId: residentAcc.id,
      responseNote: 'Đã hoàn thành trải nhựa lại đường',
      createdAt: new Date('2026-08-12T10:00:00Z'),
      updatedAt: new Date('2026-08-15T10:00:00Z'),
      neighborhood: dbNeighborhoods[0]!,
      author: residentAcc,
    };
    dbPetitions.push(pet2);

    const pet3: DbMockPetition = {
      id: randomUUID(),
      title: 'An ninh trật tự ngõ 5',
      description: 'Gây ồn ào đêm khuya...',
      category: DbPetitionCategory.security,
      status: DbPetitionStatus.processing,
      neighborhoodId: n2Id,
      authorId: residentN2Acc.id,
      responseNote: null,
      createdAt: new Date('2026-08-14T10:00:00Z'),
      updatedAt: new Date('2026-08-14T10:00:00Z'),
      neighborhood: dbNeighborhoods[1]!,
      author: residentN2Acc,
    };
    dbPetitions.push(pet3);

    // 4. Create Sessions
    const residentSessionId = await sessionService.createSession(
      residentAcc.id,
      UserRole.RESIDENT,
      AccountStatus.ACTIVE,
      n1Id,
    );
    residentCookie = `${SESSION_COOKIE_NAME}=${residentSessionId}`;

    const leaderSessionId = await sessionService.createSession(
      leaderAcc.id,
      UserRole.LEADER,
      AccountStatus.ACTIVE,
      n1Id,
    );
    leaderCookie = `${SESSION_COOKIE_NAME}=${leaderSessionId}`;

    const officerSessionId = await sessionService.createSession(
      officerAcc.id,
      UserRole.OFFICER,
      AccountStatus.ACTIVE,
      null,
    );
    officerCookie = `${SESSION_COOKIE_NAME}=${officerSessionId}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authorization and Access Control', () => {
    it('should return 401 Unauthorized for unauthenticated requests', async () => {
      const res1 = await request(app.getHttpServer()).get(
        '/api/dashboard/ward-overview',
      );
      expect(res1.status).toBe(401);
      expect(res1.body.success).toBe(false);
      expect(res1.body.errorCode).toBe(ErrorCode.UNAUTHORIZED);

      const res2 = await request(app.getHttpServer()).get(
        `/api/dashboard/neighborhoods/${n1Id}`,
      );
      expect(res2.status).toBe(401);

      const res3 = await request(app.getHttpServer()).get(
        '/api/dashboard/petition-categories',
      );
      expect(res3.status).toBe(401);

      const res4 = await request(app.getHttpServer()).get(
        '/api/dashboard/periodic-report?periodType=month&year=2026&period=1',
      );
      expect(res4.status).toBe(401);
      expect(res4.body.success).toBe(false);
      expect(res4.body.errorCode).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('should return 403 Forbidden for resident accounts', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/api/dashboard/ward-overview')
        .set('Cookie', [residentCookie]);
      expect(res1.status).toBe(403);
      expect(res1.body.success).toBe(false);
      expect(res1.body.errorCode).toBe(ErrorCode.FORBIDDEN);

      const res2 = await request(app.getHttpServer())
        .get(`/api/dashboard/neighborhoods/${n1Id}`)
        .set('Cookie', [residentCookie]);
      expect(res2.status).toBe(403);

      const res3 = await request(app.getHttpServer())
        .get('/api/dashboard/petition-categories')
        .set('Cookie', [residentCookie]);
      expect(res3.status).toBe(403);

      const res4 = await request(app.getHttpServer())
        .get('/api/dashboard/periodic-report?periodType=month&year=2026&period=1')
        .set('Cookie', [residentCookie]);
      expect(res4.status).toBe(403);
      expect(res4.body.success).toBe(false);
      expect(res4.body.errorCode).toBe(ErrorCode.FORBIDDEN);
    });

    it('should return 403 Forbidden for leader accounts', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/api/dashboard/ward-overview')
        .set('Cookie', [leaderCookie]);
      expect(res1.status).toBe(403);
      expect(res1.body.success).toBe(false);
      expect(res1.body.errorCode).toBe(ErrorCode.FORBIDDEN);

      const res2 = await request(app.getHttpServer())
        .get(`/api/dashboard/neighborhoods/${n1Id}`)
        .set('Cookie', [leaderCookie]);
      expect(res2.status).toBe(403);

      const res3 = await request(app.getHttpServer())
        .get('/api/dashboard/petition-categories')
        .set('Cookie', [leaderCookie]);
      expect(res3.status).toBe(403);

      const res4 = await request(app.getHttpServer())
        .get('/api/dashboard/periodic-report?periodType=month&year=2026&period=1')
        .set('Cookie', [leaderCookie]);
      expect(res4.status).toBe(403);
      expect(res4.body.success).toBe(false);
      expect(res4.body.errorCode).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('GET /api/dashboard/ward-overview (FR-17)', () => {
    it('should allow officer to get full ward overview metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/ward-overview')
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as WardOverviewDto;

      expect(data.neighborhoodCount).toBe(2);
      expect(data.residentCount).toBe(3); // 2 active + 1 pending
      expect(data.accountsByStatus.active).toBe(2);
      expect(data.accountsByStatus.pending).toBe(1);
      expect(data.accountsByStatus.locked).toBe(0);
      expect(data.accountsByStatus.rejected).toBe(0);

      expect(data.petitionsByStatus.reviewing).toBe(1);
      expect(data.petitionsByStatus.resolved).toBe(1);
      expect(data.petitionsByStatus.processing).toBe(1);
      expect(data.petitionsByStatus.total).toBe(3);

      // current month announcements count excludes removed
      expect(data.currentMonthAnnouncementsCount).toBe(1);

      expect(data.neighborhoodSummaries.length).toBe(2);
      const kp1 = data.neighborhoodSummaries.find((n) => n.id === n1Id);
      expect(kp1).toBeDefined();
      if (!kp1) throw new Error('Expected KP-01 summary');
      expect(kp1.code).toBe('KP-01');
      expect(kp1.residentCount).toBe(2);
      expect(kp1.activeResidentCount).toBe(1);
      expect(kp1.pendingResidentCount).toBe(1);
      expect(kp1.publishedAnnouncementsCount).toBe(2); // ann1 + annOld (published)
      expect(kp1.totalPetitionsCount).toBe(2);
      expect(kp1.resolvedPetitionsCount).toBe(1);
      expect(kp1.pendingPetitionsCount).toBe(1);
    });
  });

  describe('GET /api/dashboard/neighborhoods/:id (FR-18)', () => {
    it('should return detailed neighborhood breakdown for officer', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/dashboard/neighborhoods/${n1Id}`)
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as NeighborhoodDetailSummaryDto;

      expect(data.neighborhood.id).toBe(n1Id);
      expect(data.neighborhood.code).toBe('KP-01');
      expect(data.residentCount).toBe(2);
      expect(data.accountsByStatus.active).toBe(1);
      expect(data.accountsByStatus.pending).toBe(1);
      expect(data.publishedAnnouncementsCount).toBe(2);
      expect(data.currentMonthAnnouncementsCount).toBe(1);

      expect(data.petitionsByStatus.reviewing).toBe(1);
      expect(data.petitionsByStatus.resolved).toBe(1);
      expect(data.petitionsByStatus.total).toBe(2);

      expect(data.petitionsByCategory[PetitionCategory.SANITATION]).toBe(1);
      expect(data.petitionsByCategory[PetitionCategory.INFRASTRUCTURE]).toBe(1);
      expect(data.petitionsByCategory[PetitionCategory.SECURITY]).toBe(0);
      expect(data.petitionsByCategory[PetitionCategory.OTHER]).toBe(0);

      expect(data.recentAnnouncements.length).toBe(2);
      expect(data.recentPetitions.length).toBe(2);

      // Verify no sensitive fields leaked
      const resString = JSON.stringify(res.body);
      expect(resString).not.toContain('phoneEncrypted');
      expect(resString).not.toContain('phoneHash');
      expect(resString).not.toContain('0901111111');
    });

    it('should return 400 Bad Request for invalid UUID param', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/neighborhoods/invalid-uuid')
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 Not Found for non-existent neighborhood UUID', async () => {
      const nonExistent = '00000000-0000-4000-8000-000000000000';
      const res = await request(app.getHttpServer())
        .get(`/api/dashboard/neighborhoods/${nonExistent}`)
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe(ErrorCode.NEIGHBORHOOD_NOT_FOUND);
    });
  });

  describe('GET /api/dashboard/petition-categories (FR-19)', () => {
    it('should return all 4 categories in stable order with zero-filled counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/petition-categories')
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as PetitionCategoryAnalyticsResponseDto;

      expect(data.total).toBe(3);
      expect(data.series.length).toBe(4);

      const [infrastructure, sanitation, security, other] = data.series;
      if (!infrastructure || !sanitation || !security || !other) {
        throw new Error('Expected all four petition categories');
      }

      expect(infrastructure.category).toBe(PetitionCategory.INFRASTRUCTURE);
      expect(infrastructure.count).toBe(1);
      expect(infrastructure.resolvedCount).toBe(1);

      expect(sanitation.category).toBe(PetitionCategory.SANITATION);
      expect(sanitation.count).toBe(1);
      expect(sanitation.resolvedCount).toBe(0);

      expect(security.category).toBe(PetitionCategory.SECURITY);
      expect(security.count).toBe(1);
      expect(security.resolvedCount).toBe(0);

      expect(other.category).toBe(PetitionCategory.OTHER);
      expect(other.count).toBe(0);
      expect(other.resolvedCount).toBe(0);
      expect(other.percentage).toBe(0);
    });

    it('should filter by neighborhoodId correctly', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/dashboard/petition-categories?neighborhoodId=${n1Id}`)
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(200);
      const data = res.body.data as PetitionCategoryAnalyticsResponseDto;
      expect(data.neighborhoodId).toBe(n1Id);
      expect(data.total).toBe(2);

      const security = data.series.find(
        (s) => s.category === PetitionCategory.SECURITY,
      );
      if (!security) throw new Error('Expected security category');
      expect(security.count).toBe(0);
    });

    it('should filter by date range correctly', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/dashboard/petition-categories?startDate=2026-08-01&endDate=2026-08-11',
        )
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(200);
      const data = res.body.data as PetitionCategoryAnalyticsResponseDto;
      // In range 2026-08-01..2026-08-11: only pet1 (2026-08-10) matches
      expect(data.total).toBe(1);
      const sanitation = data.series.find(
        (s) => s.category === PetitionCategory.SANITATION,
      );
      if (!sanitation) throw new Error('Expected sanitation category');
      expect(sanitation.count).toBe(1);
    });

    it('should include the complete end date for date-only filters', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/dashboard/petition-categories?startDate=2026-08-12&endDate=2026-08-12',
        )
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(200);
      const data = res.body.data as PetitionCategoryAnalyticsResponseDto;
      expect(data.total).toBe(1);
      const infrastructure = data.series.find(
        (series) => series.category === PetitionCategory.INFRASTRUCTURE,
      );
      if (!infrastructure) {
        throw new Error('Expected infrastructure category');
      }
      expect(infrastructure.count).toBe(1);
    });

    it('should reject startDate > endDate with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/dashboard/petition-categories?startDate=2026-08-20&endDate=2026-08-10',
        )
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should reject invalid UUID for neighborhoodId query with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/petition-categories?neighborhoodId=not-a-uuid')
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should reject non-existent neighborhoodId query with 404 Not Found', async () => {
      const nonExistent = '00000000-0000-4000-8000-000000000000';
      const res = await request(app.getHttpServer())
        .get(`/api/dashboard/petition-categories?neighborhoodId=${nonExistent}`)
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe(ErrorCode.NEIGHBORHOOD_NOT_FOUND);
    });
  });

  describe('GET /api/dashboard/periodic-report (FR-20)', () => {
    it('should allow officer to get monthly periodic report with correct structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/periodic-report?periodType=month&year=2026&period=8')
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as PeriodicReportResponseDto;

      expect(data.periodType).toBe(ReportingPeriodType.MONTH);
      expect(data.year).toBe(2026);
      expect(data.period).toBe(8);
      expect(data.label).toBe('Tháng 8/2026');
      expect(data.startDate).toBe('2026-08-01T00:00:00.000Z');
      expect(data.endDateExclusive).toBe('2026-09-01T00:00:00.000Z');
      expect(typeof data.generatedAt).toBe('string');
      expect(Array.isArray(data.warnings)).toBe(true);

      // Ward summary
      expect(data.summary.neighborhoodCount).toBe(2);
      expect(data.summary.activeResidentCount).toBe(2); // 2 active accounts
      expect(data.summary.newResidentRegistrationsCount).toBe(3); // 3 accounts registered in August 2026
      expect(data.summary.publishedAnnouncementsCount).toBe(1); // 1 announcement in August 2026
      expect(data.summary.petitionsByStatus.total).toBe(3); // 3 petitions created in August 2026

      // Neighborhood rows in stable order
      expect(data.neighborhoods.length).toBe(2);
      expect(data.neighborhoods[0]?.code).toBe('KP-01');
      expect(data.neighborhoods[1]?.code).toBe('KP-02');

      const kp1 = data.neighborhoods[0];
      if (!kp1) throw new Error('Expected KP-01 row');
      expect(kp1.activeResidentCount).toBe(1);
      expect(kp1.newResidentRegistrationsCount).toBe(2);
      expect(kp1.publishedAnnouncementsCount).toBe(1);
      expect(kp1.petitionsByStatus.total).toBe(2);

      // Verify no sensitive fields leaked
      const resString = JSON.stringify(res.body);
      expect(resString).not.toContain('phoneEncrypted');
      expect(resString).not.toContain('phoneHash');
      expect(resString).not.toContain('0901111111');
      expect(resString).not.toContain('0988888888');
    });

    it('should allow officer to get quarterly periodic report with correct boundaries', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/periodic-report?periodType=quarter&year=2026&period=3')
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data as PeriodicReportResponseDto;

      expect(data.periodType).toBe(ReportingPeriodType.QUARTER);
      expect(data.year).toBe(2026);
      expect(data.period).toBe(3);
      expect(data.label).toBe('Quý 3/2026');
      expect(data.startDate).toBe('2026-07-01T00:00:00.000Z');
      expect(data.endDateExclusive).toBe('2026-10-01T00:00:00.000Z');
      expect(data.summary.neighborhoodCount).toBe(2);
    });

    it('should reject invalid periodType with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/periodic-report?periodType=annual&year=2026&period=1')
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should reject invalid month (> 12 or < 1) with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/periodic-report?periodType=month&year=2026&period=13')
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should reject invalid quarter (> 4 or < 1) with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/periodic-report?periodType=quarter&year=2026&period=5')
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should reject future period with 400 Bad Request and VALIDATION_ERROR', async () => {
      const futureYear = new Date().getUTCFullYear() + 1;
      const res = await request(app.getHttpServer())
        .get(`/api/dashboard/periodic-report?periodType=month&year=${futureYear}&period=1`)
        .set('Cookie', [officerCookie]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });
});
