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
  Gender,
  UserRole,
} from '@quanlykhupho/shared-types';

type DbMockAccount = Account & {
  neighborhood: Neighborhood | null;
};

type DbMockResidentProfile = ResidentProfile & {
  household: Household | null;
  neighborhood: Neighborhood | null;
};

function getStringContains(filter: unknown): string | undefined {
  if (
    typeof filter !== 'object' ||
    filter === null ||
    !('contains' in filter)
  ) {
    return undefined;
  }

  const contains = (filter as Record<string, unknown>).contains;
  return typeof contains === 'string' ? contains : undefined;
}

describe('Resident Profiles Workflow (e2e)', () => {
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
  const dbHouseholds: Household[] = [];
  const dbResidentProfiles: DbMockResidentProfile[] = [];

  let residentCookie: string;
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
          if (where?.role) list = list.filter((a) => a.role === where.role);
          if (where?.status) list = list.filter((a) => a.status === where.status);
          if (where?.neighborhoodId) list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
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
      household: {
        findUnique: async ({
          where,
        }: {
          where: Prisma.HouseholdWhereUniqueInput;
        }) => {
          if (where.id) {
            return dbHouseholds.find((h) => h.id === where.id) || null;
          }
          if (where.neighborhoodId_code) {
            return (
              dbHouseholds.find(
                (h) =>
                  h.neighborhoodId === where.neighborhoodId_code?.neighborhoodId &&
                  h.code.toLowerCase() === where.neighborhoodId_code?.code.toLowerCase(),
              ) || null
            );
          }
          return null;
        },
        create: async ({ data }: { data: Prisma.HouseholdUncheckedCreateInput }) => {
          const created: Household = {
            id: randomUUID(),
            code: data.code,
            neighborhoodId: data.neighborhoodId,
            address: data.address,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          dbHouseholds.push(created);
          return created;
        },
        upsert: async ({
          where,
          create,
        }: {
          where: Prisma.HouseholdWhereUniqueInput;
          create: Prisma.HouseholdUncheckedCreateInput;
          update: Prisma.HouseholdUncheckedUpdateInput;
        }) => {
          const key = where.neighborhoodId_code;
          const existing = key
            ? dbHouseholds.find(
                (household) =>
                  household.neighborhoodId === key.neighborhoodId &&
                  household.code === key.code,
              )
            : undefined;
          if (existing) return existing;

          const created: Household = {
            id: randomUUID(),
            code: create.code,
            neighborhoodId: create.neighborhoodId,
            address: create.address,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          dbHouseholds.push(created);
          return created;
        },
      },
      residentProfile: {
        findUnique: async ({
          where,
        }: {
          where: Prisma.ResidentProfileWhereUniqueInput;
        }) => {
          if (where.id) {
            return dbResidentProfiles.find((p) => p.id === where.id) || null;
          }
          if (where.citizenIdHash) {
            return (
              dbResidentProfiles.find(
                (p) => p.citizenIdHash === where.citizenIdHash,
              ) || null
            );
          }
          return null;
        },
        findMany: async ({
          where,
          skip,
          take,
        }: {
          where?: Prisma.ResidentProfileWhereInput;
          skip?: number;
          take?: number;
        }) => {
          let list = [...dbResidentProfiles];
          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
          }
          if (where?.gender) {
            list = list.filter((p) => p.gender === where.gender);
          }
          if (where?.citizenIdHash) {
            list = list.filter((p) => p.citizenIdHash === where.citizenIdHash);
          }
          if (where?.relationshipToHead) {
            const relSearch = getStringContains(where.relationshipToHead);
            if (relSearch) {
              list = list.filter((p) =>
                p.relationshipToHead?.toLowerCase().includes(relSearch.toLowerCase()),
              );
            }
          }
          if (where?.occupation) {
            const occSearch = getStringContains(where.occupation);
            if (occSearch) {
              list = list.filter((p) =>
                p.occupation?.toLowerCase().includes(occSearch.toLowerCase()),
              );
            }
          }
          if (where?.ward) {
            const wardSearch = getStringContains(where.ward);
            if (wardSearch) {
              list = list.filter((p) =>
                p.ward?.toLowerCase().includes(wardSearch.toLowerCase()),
              );
            }
          }
          if (where?.birthDate) {
            const bd = where.birthDate as Prisma.DateTimeFilter;
            if (bd.lte) {
              list = list.filter((p) => p.birthDate <= new Date(bd.lte as Date));
            }
            if (bd.gt) {
              list = list.filter((p) => p.birthDate > new Date(bd.gt as Date));
            }
          }
          if (where?.OR && Array.isArray(where.OR)) {
            list = list.filter((p) =>
              where.OR!.some((cond) => {
                if (cond.citizenIdHash && p.citizenIdHash === cond.citizenIdHash) return true;
                const fullNameSearch = getStringContains(cond.fullName);
                if (
                  fullNameSearch &&
                  p.fullName.toLowerCase().includes(fullNameSearch.toLowerCase())
                ) {
                  return true;
                }
                const householdCodeSearch = getStringContains(
                  cond.household?.code,
                );
                if (
                  householdCodeSearch &&
                  p.household?.code
                    .toLowerCase()
                    .includes(householdCodeSearch.toLowerCase())
                ) {
                  return true;
                }
                return false;
              }),
            );
          }
          const s = skip || 0;
          const t = take || list.length;
          return list.slice(s, s + t);
        },
        count: async ({ where }: { where?: Prisma.ResidentProfileWhereInput }) => {
          let list = [...dbResidentProfiles];
          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
          }
          if (where?.gender) {
            list = list.filter((p) => p.gender === where.gender);
          }
          if (where?.citizenIdHash) {
            list = list.filter((p) => p.citizenIdHash === where.citizenIdHash);
          }
          if (where?.relationshipToHead) {
            const relSearch = getStringContains(where.relationshipToHead);
            if (relSearch) {
              list = list.filter((p) =>
                p.relationshipToHead?.toLowerCase().includes(relSearch.toLowerCase()),
              );
            }
          }
          if (where?.occupation) {
            const occSearch = getStringContains(where.occupation);
            if (occSearch) {
              list = list.filter((p) =>
                p.occupation?.toLowerCase().includes(occSearch.toLowerCase()),
              );
            }
          }
          if (where?.ward) {
            const wardSearch = getStringContains(where.ward);
            if (wardSearch) {
              list = list.filter((p) =>
                p.ward?.toLowerCase().includes(wardSearch.toLowerCase()),
              );
            }
          }
          if (where?.birthDate) {
            const bd = where.birthDate as Prisma.DateTimeFilter;
            if (bd.lte) {
              list = list.filter((p) => p.birthDate <= new Date(bd.lte as Date));
            }
            if (bd.gt) {
              list = list.filter((p) => p.birthDate > new Date(bd.gt as Date));
            }
          }
          if (where?.OR && Array.isArray(where.OR)) {
            list = list.filter((p) =>
              where.OR!.some((cond) => {
                if (cond.citizenIdHash && p.citizenIdHash === cond.citizenIdHash) return true;
                const fullNameSearch = getStringContains(cond.fullName);
                if (
                  fullNameSearch &&
                  p.fullName.toLowerCase().includes(fullNameSearch.toLowerCase())
                ) {
                  return true;
                }
                const householdCodeSearch = getStringContains(
                  cond.household?.code,
                );
                if (
                  householdCodeSearch &&
                  p.household?.code
                    .toLowerCase()
                    .includes(householdCodeSearch.toLowerCase())
                ) {
                  return true;
                }
                return false;
              }),
            );
          }
          return list.length;
        },
        create: async ({
          data,
        }: {
          data: Prisma.ResidentProfileUncheckedCreateInput;
        }) => {
          const household = dbHouseholds.find((h) => h.id === data.householdId) || null;
          const neighborhood =
            dbNeighborhoods.find((n) => n.id === data.neighborhoodId) || null;
          const created: DbMockResidentProfile = {
            id: randomUUID(),
            fullName: data.fullName,
            citizenIdEncrypted: data.citizenIdEncrypted,
            citizenIdHash: data.citizenIdHash,
            citizenIdIssueDate: data.citizenIdIssueDate ? new Date(data.citizenIdIssueDate) : null,
            birthDate: new Date(data.birthDate),
            gender: data.gender ?? DbGender.other,
            placeOfBirth: data.placeOfBirth ?? null,
            relationshipToHead: data.relationshipToHead ?? null,
            phoneEncrypted: data.phoneEncrypted ?? null,
            emailEncrypted: data.emailEncrypted ?? null,
            occupation: data.occupation ?? null,
            permanentAddress: data.permanentAddress,
            currentAddress: data.currentAddress ?? null,
            ward: data.ward ?? null,
            city: data.city ?? null,
            householdId: data.householdId,
            neighborhoodId: data.neighborhoodId,
            createdAt: new Date(),
            updatedAt: new Date(),
            household,
            neighborhood,
          };
          dbResidentProfiles.push(created);
          return created;
        },
        update: async ({
          where,
          data,
        }: {
          where: Prisma.ResidentProfileWhereUniqueInput;
          data: Prisma.ResidentProfileUncheckedUpdateInput;
        }) => {
          const item = dbResidentProfiles.find((p) => p.id === where.id);
          if (!item) throw new Error('Not found');

          if (data.fullName !== undefined) item.fullName = data.fullName as string;
          if (data.citizenIdEncrypted !== undefined)
            item.citizenIdEncrypted = data.citizenIdEncrypted as string;
          if (data.citizenIdHash !== undefined) item.citizenIdHash = data.citizenIdHash as string;
          if (data.citizenIdIssueDate !== undefined)
            item.citizenIdIssueDate = data.citizenIdIssueDate
              ? new Date(data.citizenIdIssueDate as string)
              : null;
          if (data.birthDate !== undefined) item.birthDate = new Date(data.birthDate as string);
          if (data.gender !== undefined) item.gender = data.gender as DbGender;
          if (data.placeOfBirth !== undefined) item.placeOfBirth = data.placeOfBirth as string | null;
          if (data.relationshipToHead !== undefined)
            item.relationshipToHead = data.relationshipToHead as string | null;
          if (data.phoneEncrypted !== undefined)
            item.phoneEncrypted = data.phoneEncrypted as string | null;
          if (data.emailEncrypted !== undefined)
            item.emailEncrypted = data.emailEncrypted as string | null;
          if (data.occupation !== undefined) item.occupation = data.occupation as string | null;
          if (data.permanentAddress !== undefined)
            item.permanentAddress = data.permanentAddress as string;
          if (data.currentAddress !== undefined)
            item.currentAddress = data.currentAddress as string | null;
          if (data.ward !== undefined) item.ward = data.ward as string | null;
          if (data.city !== undefined) item.city = data.city as string | null;
          if (data.householdId !== undefined) {
            item.householdId = data.householdId as string;
            item.household = dbHouseholds.find((h) => h.id === data.householdId) || null;
          }
          if (data.neighborhoodId !== undefined) {
            item.neighborhoodId = data.neighborhoodId as string;
            item.neighborhood =
              dbNeighborhoods.find((n) => n.id === data.neighborhoodId) || null;
          }
          item.updatedAt = new Date();
          return item;
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

    // Create accounts
    const residentAcc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('+84900000001'),
        phoneHash: cryptoService.hashPhone('+84900000001'),
        fullName: 'Nguyễn Văn Cư Dân',
        role: Role.resident,
        status: DbAccountStatus.active,
        neighborhoodId: dbNeighborhoods[0]!.id,
      },
    });

    const leader1Acc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('+84900000002'),
        phoneHash: cryptoService.hashPhone('+84900000002'),
        fullName: 'Trưởng Khu Phố 1',
        role: Role.leader,
        status: DbAccountStatus.active,
        neighborhoodId: dbNeighborhoods[0]!.id,
      },
    });

    const leader2Acc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('+84900000003'),
        phoneHash: cryptoService.hashPhone('+84900000003'),
        fullName: 'Trưởng Khu Phố 2',
        role: Role.leader,
        status: DbAccountStatus.active,
        neighborhoodId: dbNeighborhoods[1]!.id,
      },
    });

    const officerAcc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('+84900000004'),
        phoneHash: cryptoService.hashPhone('+84900000004'),
        fullName: 'Cán Bộ Phường',
        role: Role.officer,
        status: DbAccountStatus.active,
        neighborhoodId: null,
      },
    });

    // Create active sessions
    const resSession = await sessionService.createSession(
      residentAcc.id,
      UserRole.RESIDENT,
      AccountStatus.ACTIVE,
      residentAcc.neighborhoodId,
    );
    residentCookie = `${SESSION_COOKIE_NAME}=${resSession}`;

    const lead1Session = await sessionService.createSession(
      leader1Acc.id,
      UserRole.LEADER,
      AccountStatus.ACTIVE,
      leader1Acc.neighborhoodId,
    );
    leader1Cookie = `${SESSION_COOKIE_NAME}=${lead1Session}`;

    const lead2Session = await sessionService.createSession(
      leader2Acc.id,
      UserRole.LEADER,
      AccountStatus.ACTIVE,
      leader2Acc.neighborhoodId,
    );
    leader2Cookie = `${SESSION_COOKIE_NAME}=${lead2Session}`;

    const offSession = await sessionService.createSession(
      officerAcc.id,
      UserRole.OFFICER,
      AccountStatus.ACTIVE,
      null,
    );
    officerCookie = `${SESSION_COOKIE_NAME}=${offSession}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get('/api/resident-profiles')
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/resident-profiles')
        .send({
          fullName: 'Test',
          citizenId: '012345678901',
          birthDate: '1990-01-01T00:00:00.000Z',
          permanentAddress: '123 Lê Lợi',
          householdCode: 'HK-01',
        })
        .expect(401);
    });

    it('should return 403 when resident attempts to access resident profiles', async () => {
      await request(app.getHttpServer())
        .get('/api/resident-profiles')
        .set('Cookie', [residentCookie])
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/resident-profiles')
        .set('Cookie', [residentCookie])
        .set('Origin', 'http://localhost:3000')
        .send({
          fullName: 'Test',
          citizenId: '012345678901',
          birthDate: '1990-01-01T00:00:00.000Z',
          permanentAddress: '123 Lê Lợi',
          householdCode: 'HK-01',
        })
        .expect(403);
    });
  });

  describe('Leader & Officer Profile Creation', () => {
    it('should allow leader 1 to create resident profile in KP-01', async () => {
      const payload = {
        fullName: 'Nguyễn Văn An',
        citizenId: '001090123456',
        citizenIdIssueDate: '2021-05-10T00:00:00.000Z',
        birthDate: '1990-05-10T00:00:00.000Z',
        gender: Gender.MALE,
        placeOfBirth: 'Hà Nội',
        relationshipToHead: 'Chủ hộ',
        phoneNumber: '0912345678',
        email: 'an.nv@example.com',
        occupation: 'Kỹ sư',
        permanentAddress: '10 Lê Lợi, Bến Nghé',
        householdCode: 'HK-KP1-001',
      };

      const res = await request(app.getHttpServer())
        .post('/api/resident-profiles')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe('Nguyễn Văn An');
      expect(res.body.data.citizenId).toBe('001090123456');
      expect(res.body.data.maskedCitizenId).toBe('001******456');
      expect(res.body.data.maskedPhone).toBe('091***5678');
      expect(res.body.data.neighborhoodId).toBe(dbNeighborhoods[0]!.id);
      expect(res.body.data.household.code).toBe('HK-KP1-001');

      // Verify no plaintext citizenId is stored in mock DB
      const stored = dbResidentProfiles.find((p) => p.id === res.body.data.id);
      expect(stored).toBeDefined();
      expect(stored!.citizenIdEncrypted).not.toBe('001090123456');
      expect(stored!.citizenIdHash).toBe(cryptoService.hashCitizenId('001090123456'));
    });

    it('should allow officer to create resident profile in specified neighborhood', async () => {
      const payload = {
        fullName: 'Trần Thị Bình',
        citizenId: '001095654321',
        birthDate: '1995-08-20T00:00:00.000Z',
        gender: Gender.FEMALE,
        permanentAddress: '20 Hai Bà Trưng',
        householdCode: 'HK-KP2-001',
        neighborhoodId: dbNeighborhoods[1]!.id,
      };

      const res = await request(app.getHttpServer())
        .post('/api/resident-profiles')
        .set('Cookie', [officerCookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe('Trần Thị Bình');
      expect(res.body.data.neighborhoodId).toBe(dbNeighborhoods[1]!.id);
    });

    it('should reject duplicate citizen ID with 409 Conflict', async () => {
      const duplicatePayload = {
        fullName: 'Nguyễn Văn An Fake',
        citizenId: '001090123456', // Same as first test
        birthDate: '1992-01-01T00:00:00.000Z',
        permanentAddress: '10 Lê Lợi',
        householdCode: 'HK-KP1-001',
      };

      const res = await request(app.getHttpServer())
        .post('/api/resident-profiles')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(duplicatePayload)
        .expect(409);

      expect(res.body.errorCode).toBe(ErrorCode.CITIZEN_ID_ALREADY_EXISTS);
    });

    it('should reject invalid citizen ID format (non-12 digits)', async () => {
      const invalidCid = {
        fullName: 'Lỗi CCCD',
        citizenId: '12345678',
        birthDate: '1990-01-01T00:00:00.000Z',
        permanentAddress: '10 Lê Lợi',
        householdCode: 'HK-KP1-001',
      };

      await request(app.getHttpServer())
        .post('/api/resident-profiles')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(invalidCid)
        .expect(400);
    });

    it('should reject future birth date with 400 Bad Request', async () => {
      const futureBirth = {
        fullName: 'Tương Lai',
        citizenId: '079200000001',
        birthDate: '2099-01-01T00:00:00.000Z',
        permanentAddress: '10 Lê Lợi',
        householdCode: 'HK-KP1-001',
      };

      await request(app.getHttpServer())
        .post('/api/resident-profiles')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(futureBirth)
        .expect(400);
    });
  });

  describe('Scoped List & Search', () => {
    it('should restrict leader 1 to only KP-01 profiles', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/resident-profiles')
        .set('Cookie', [leader1Cookie])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].neighborhoodId).toBe(dbNeighborhoods[0]!.id);
      expect(res.body.data.items[0].maskedCitizenId).toBe('001******456');
      expect(res.body.data.items[0].citizenId).toBeUndefined(); // Masked in list
    });

    it('should allow officer to see all profiles and filter by neighborhood', async () => {
      const allRes = await request(app.getHttpServer())
        .get('/api/resident-profiles')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(allRes.body.data.items.length).toBe(2);

      const filterRes = await request(app.getHttpServer())
        .get(`/api/resident-profiles?neighborhoodId=${dbNeighborhoods[1]!.id}`)
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(filterRes.body.data.items.length).toBe(1);
      expect(filterRes.body.data.items[0].fullName).toBe('Trần Thị Bình');
    });

    it('should support search by exact 12-digit citizen ID via HMAC lookup', async () => {
      const searchRes = await request(app.getHttpServer())
        .get('/api/resident-profiles?search=001090123456')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(searchRes.body.data.items.length).toBe(1);
      expect(searchRes.body.data.items[0].fullName).toBe('Nguyễn Văn An');
    });

    it('should support search by full name', async () => {
      const searchRes = await request(app.getHttpServer())
        .get('/api/resident-profiles?search=Trần Thị Bình')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(searchRes.body.data.items.length).toBe(1);
      expect(searchRes.body.data.items[0].fullName).toBe('Trần Thị Bình');
    });
  });

  describe('Detail & Scoped Update', () => {
    it('should allow leader 1 to view detail of profile in KP-01 with decrypted citizen ID', async () => {
      const profileId = dbResidentProfiles[0]!.id;

      const res = await request(app.getHttpServer())
        .get(`/api/resident-profiles/${profileId}`)
        .set('Cookie', [leader1Cookie])
        .expect(200);

      expect(res.body.data.citizenId).toBe('001090123456');
      expect(res.body.data.phoneNumber).toBe('+84912345678');
      expect(res.body.data.email).toBe('an.nv@example.com');
    });

    it('should prevent leader 2 from viewing detail of profile in KP-01 (403 Forbidden)', async () => {
      const profileId = dbResidentProfiles[0]!.id;

      const res = await request(app.getHttpServer())
        .get(`/api/resident-profiles/${profileId}`)
        .set('Cookie', [leader2Cookie])
        .expect(403);

      expect(res.body.errorCode).toBe(ErrorCode.FORBIDDEN);
    });

    it('should allow leader 1 to update profile in KP-01', async () => {
      const profileId = dbResidentProfiles[0]!.id;

      const updatePayload = {
        occupation: 'Trưởng phòng Kỹ thuật',
        currentAddress: '15 Lê Lợi, Phường Bến Nghé',
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/resident-profiles/${profileId}`)
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(updatePayload)
        .expect(200);

      expect(res.body.data.occupation).toBe('Trưởng phòng Kỹ thuật');
      expect(res.body.data.currentAddress).toBe('15 Lê Lợi, Phường Bến Nghé');
    });

    it('should prevent leader 2 from updating profile in KP-01 (403 Forbidden)', async () => {
      const profileId = dbResidentProfiles[0]!.id;

      await request(app.getHttpServer())
        .patch(`/api/resident-profiles/${profileId}`)
        .set('Cookie', [leader2Cookie])
        .set('Origin', 'http://localhost:3000')
        .send({ occupation: 'Hack' })
        .expect(403);
    });
  });

  describe('Advanced Filters & Extraction Workflow (FR-24)', () => {
    it('should allow leader to extract matching residents returning only id and fullName', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/resident-profiles/extract?gender=male')
        .set('Cookie', [leader1Cookie])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      const first = res.body.data.items[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('fullName');
      // Verify no sensitive fields returned
      expect(first.citizenId).toBeUndefined();
      expect(first.phone).toBeUndefined();
      expect(first.email).toBeUndefined();
      expect(first.birthDate).toBeUndefined();
      expect(first.neighborhoodId).toBeUndefined();
    });

    it('should reject extraction request from resident role with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/resident-profiles/extract')
        .set('Cookie', [residentCookie])
        .expect(403);

      expect(res.body.errorCode).toBe(ErrorCode.FORBIDDEN);
    });

    it('should reject invalid age bounds (ageFrom > ageTo) with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/resident-profiles/extract?ageFrom=50&ageTo=20')
        .set('Cookie', [officerCookie])
        .expect(400);

      expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should allow officer to extract with combined filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/resident-profiles/extract?ward=B%E1%BA%BFn%20Ngh%C3%A9&gender=female')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].fullName).toBe('Trần Thị Bình');
    });
  });
});
