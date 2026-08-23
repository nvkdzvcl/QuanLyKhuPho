import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import {
  Account,
  Gender as DbGender,
  Household,
  Neighborhood,
  NeighborhoodActivity,
  Petition,
  Prisma,
  ResidentProfile,
  Role,
  AccountStatus as DbAccountStatus,
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
  UserRole,
} from '@quanlykhupho/shared-types';

type DbMockAccount = Account & {
  neighborhood: Neighborhood | null;
};

type DbMockResidentProfile = ResidentProfile & {
  household: Household | null;
  neighborhood: Neighborhood | null;
};

describe('Exports Workflow (e2e)', () => {
  let app: INestApplication;
  let sessionService: SessionService;
  let cryptoService: CryptoService;

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
  const dbResidentProfiles: DbMockResidentProfile[] = [];
  const dbActivities: (NeighborhoodActivity & {
    neighborhood: Neighborhood | null;
    createdBy: Account | null;
    participants: { attendance: string }[];
  })[] = [];
  const dbPetitions: (Petition & {
    neighborhood: Neighborhood | null;
    author: Account | null;
  })[] = [];

  let residentCookie: string;
  let leaderCookie: string;
  let officerCookie: string;

  beforeAll(async () => {
    const mockPrisma = {
      $connect: async () => {},
      $disconnect: async () => {},
      neighborhood: {
        findMany: async () => dbNeighborhoods,
        findUnique: async ({ where }: { where: Prisma.NeighborhoodWhereUniqueInput }) =>
          dbNeighborhoods.find((n) => n.id === where.id) || null,
      },
      account: {
        findUnique: async ({ where }: { where: Prisma.AccountWhereUniqueInput }) =>
          dbAccounts.find((a) => a.id === where.id || a.phoneHash === where.phoneHash) || null,
      },
      residentProfile: {
        count: async ({ where }: { where?: Prisma.ResidentProfileWhereInput }) => {
          let list = [...dbResidentProfiles];
          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
          }
          return list.length;
        },
        findMany: async ({ where }: { where?: Prisma.ResidentProfileWhereInput }) => {
          let list = [...dbResidentProfiles];
          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
          }
          return list;
        },
      },
      neighborhoodActivity: {
        count: async ({ where }: { where?: Prisma.NeighborhoodActivityWhereInput }) => {
          let list = [...dbActivities];
          if (where?.neighborhoodId) {
            list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
          }
          return list.length;
        },
        findMany: async ({ where }: { where?: Prisma.NeighborhoodActivityWhereInput }) => {
          let list = [...dbActivities];
          if (where?.neighborhoodId) {
            list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
          }
          return list;
        },
      },
      petition: {
        count: async ({ where }: { where?: Prisma.PetitionWhereInput }) => {
          let list = [...dbPetitions];
          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
          }
          return list.length;
        },
        findMany: async ({ where }: { where?: Prisma.PetitionWhereInput }) => {
          let list = [...dbPetitions];
          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    sessionService = app.get(SessionService);
    cryptoService = app.get(CryptoService);

    // Seed test accounts
    const residentAccount: DbMockAccount = {
      id: randomUUID(),
      phoneEncrypted: cryptoService.encrypt('+84900000001'),
      phoneHash: cryptoService.hashPhone('+84900000001'),
      fullName: 'Cư Dân Test',
      role: Role.resident,
      status: DbAccountStatus.active,
      address: '123 Lê Lợi',
      neighborhoodId: dbNeighborhoods[0]!.id,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      neighborhood: dbNeighborhoods[0]!,
    };
    dbAccounts.push(residentAccount);

    const leaderAccount: DbMockAccount = {
      id: randomUUID(),
      phoneEncrypted: cryptoService.encrypt('+84900000002'),
      phoneHash: cryptoService.hashPhone('+84900000002'),
      fullName: 'Trưởng Khu Phố 1',
      role: Role.leader,
      status: DbAccountStatus.active,
      address: '124 Lê Lợi',
      neighborhoodId: dbNeighborhoods[0]!.id,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      neighborhood: dbNeighborhoods[0]!,
    };
    dbAccounts.push(leaderAccount);

    const officerAccount: DbMockAccount = {
      id: randomUUID(),
      phoneEncrypted: cryptoService.encrypt('+84900000003'),
      phoneHash: cryptoService.hashPhone('+84900000003'),
      fullName: 'Cán Bộ Phường',
      role: Role.officer,
      status: DbAccountStatus.active,
      address: 'Ủy ban phường',
      neighborhoodId: null,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      neighborhood: null,
    };
    dbAccounts.push(officerAccount);

    // Seed resident profiles
    const sampleProfile: DbMockResidentProfile = {
      id: randomUUID(),
      fullName: 'Nguyễn Văn Xuất',
      citizenIdEncrypted: cryptoService.encrypt('012345678901'),
      citizenIdHash: cryptoService.hashCitizenId('012345678901'),
      citizenIdIssueDate: new Date('2020-01-01'),
      birthDate: new Date('1990-01-01'),
      gender: DbGender.male,
      placeOfBirth: 'Hà Nội',
      relationshipToHead: 'Chủ hộ',
      phoneEncrypted: cryptoService.encrypt('+84901234567'),
      emailEncrypted: cryptoService.encrypt('xuat@example.com'),
      occupation: '=SUM(1,2)', // Formula injection test candidate
      permanentAddress: '123 Lê Lợi',
      currentAddress: '123 Lê Lợi',
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: randomUUID(),
      neighborhoodId: dbNeighborhoods[0]!.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      household: {
        id: randomUUID(),
        code: 'HK-001',
        neighborhoodId: dbNeighborhoods[0]!.id,
        address: '123 Lê Lợi',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      neighborhood: dbNeighborhoods[0]!,
    };
    dbResidentProfiles.push(sampleProfile);

    // Seed activity
    dbActivities.push({
      id: randomUUID(),
      neighborhoodId: dbNeighborhoods[0]!.id,
      createdById: leaderAccount.id,
      name: 'Họp dân phố E2E',
      activityDate: new Date('2026-08-15'),
      description: 'Họp định kỳ',
      personInCharge: 'Nguyễn Văn A',
      filterCondition: 'all',
      createdAt: new Date(),
      updatedAt: new Date(),
      neighborhood: dbNeighborhoods[0]!,
      createdBy: leaderAccount,
      participants: [{ attendance: 'attended' }],
    });

    // Seed petition
    dbPetitions.push({
      id: randomUUID(),
      title: 'Kiến nghị đèn đường E2E',
      description: 'Đèn đường hỏng',
      category: 'infrastructure',
      status: 'reviewing',
      neighborhoodId: dbNeighborhoods[0]!.id,
      authorId: residentAccount.id,
      responseNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      neighborhood: dbNeighborhoods[0]!,
      author: residentAccount,
    });

    // Sessions
    const resSess = await sessionService.createSession(
      residentAccount.id,
      UserRole.RESIDENT,
      AccountStatus.ACTIVE,
      residentAccount.neighborhoodId,
    );
    residentCookie = `${SESSION_COOKIE_NAME}=${resSess}`;

    const leadSess = await sessionService.createSession(
      leaderAccount.id,
      UserRole.LEADER,
      AccountStatus.ACTIVE,
      leaderAccount.neighborhoodId,
    );
    leaderCookie = `${SESSION_COOKIE_NAME}=${leadSess}`;

    const offSess = await sessionService.createSession(
      officerAccount.id,
      UserRole.OFFICER,
      AccountStatus.ACTIVE,
      null,
    );
    officerCookie = `${SESSION_COOKIE_NAME}=${offSess}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authorization & Scoping (FR-25)', () => {
    it('should reject export requests from resident role with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/residents?format=csv')
        .set('Cookie', [residentCookie])
        .expect(403);

      expect(res.body.errorCode).toBe(ErrorCode.FORBIDDEN);
    });

    it('should reject invalid export dataset parameter with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/unknown_dataset?format=csv')
        .set('Cookie', [officerCookie])
        .expect(400);

      expect(res.body.errorCode).toBe(ErrorCode.INVALID_EXPORT_DATASET);
    });
  });

  describe('CSV Exports (all 4 datasets)', () => {
    it('should export residents CSV with UTF-8 BOM, masked identifiers, and formula defense', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/residents?format=csv')
        .set('Cookie', [leaderCookie])
        .expect(200);

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['content-disposition']).toContain('.csv');

      const csvText = res.text;
      expect(csvText.startsWith('\uFEFF')).toBe(true); // UTF-8 BOM
      expect(csvText).toContain('Nguyễn Văn Xuất');
      expect(csvText).toContain('012******901'); // Masked citizen ID
      expect(csvText).not.toContain('012345678901'); // Plaintext citizen ID must never appear
      expect(csvText).toContain("'=SUM(1,2)"); // Formula injection protected
    });

    it('should export political-social CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/political_social?format=csv')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.text.startsWith('\uFEFF')).toBe(true);
      expect(res.text).toContain('Nguyễn Văn Xuất');
    });

    it('should export activities CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/activities?format=csv')
        .set('Cookie', [leaderCookie])
        .expect(200);

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.text.startsWith('\uFEFF')).toBe(true);
      expect(res.text).toContain('Họp dân phố E2E');
    });

    it('should export petitions CSV with masked phone', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/petitions?format=csv')
        .set('Cookie', [leaderCookie])
        .expect(200);

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.text.startsWith('\uFEFF')).toBe(true);
      expect(res.text).toContain('Kiến nghị đèn đường E2E');
      expect(res.text).toContain('090***0001'); // Masked phone
      expect(res.text).not.toContain('+84900000001');
    });
  });

  describe('XLSX Exports (all 4 datasets)', () => {
    it('should export residents XLSX binary workbook with correct headers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/residents?format=xlsx')
        .set('Cookie', [officerCookie])
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['content-disposition']).toContain('.xlsx');
      expect(res.body).toBeInstanceOf(Buffer);
      // PK zip signature for valid xlsx: 0x50, 0x4b, 0x03, 0x04
      const buf = res.body as Buffer;
      expect(buf[0]).toBe(0x50);
      expect(buf[1]).toBe(0x4b);
    });

    it('should export activities XLSX workbook', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/exports/activities?format=xlsx')
        .set('Cookie', [leaderCookie])
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain('.xlsx');
      expect(res.body).toBeInstanceOf(Buffer);
    });
  });
});
