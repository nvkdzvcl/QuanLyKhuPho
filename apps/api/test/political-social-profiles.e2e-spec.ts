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
  PoliticalSocialProfile,
  Prisma,
  ResidentProfile,
  Role,
  AccountStatus as DbAccountStatus,
  PartyStatus as DbPartyStatus,
  HighestEducation as DbHighestEducation,
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
  HighestEducation,
  PartyStatus,
  UserRole,
} from '@quanlykhupho/shared-types';

type DbMockAccount = Account & {
  neighborhood: Neighborhood | null;
};

type DbMockResidentProfile = ResidentProfile & {
  household: Household | null;
  neighborhood: Neighborhood | null;
  politicalSocialProfile: PoliticalSocialProfile | null;
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

describe('Political & Social Profiles Workflow (e2e)', () => {
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
  const dbPoliticalSocialProfiles: PoliticalSocialProfile[] = [];

  let residentCookie: string;
  let leader1Cookie: string;
  let leader2Cookie: string;
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
        findMany: async ({ where }: { where?: Prisma.AccountWhereInput }) => {
          let list = [...dbAccounts];
          if (where?.role) list = list.filter((a) => a.role === where.role);
          if (where?.status) list = list.filter((a) => a.status === where.status);
          if (where?.neighborhoodId)
            list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
          return list;
        },
        create: async ({
          data,
        }: {
          data: Prisma.AccountUncheckedCreateInput;
        }) => {
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
            neighborhood:
              dbNeighborhoods.find((n) => n.id === data.neighborhoodId) || null,
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
          return null;
        },
        create: async ({
          data,
        }: {
          data: Prisma.HouseholdUncheckedCreateInput;
        }) => {
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
      },
      residentProfile: {
        findUnique: async ({
          where,
        }: {
          where: Prisma.ResidentProfileWhereUniqueInput;
        }) => {
          const p = dbResidentProfiles.find((r) => r.id === where.id) || null;
          if (!p) return null;
          p.politicalSocialProfile =
            dbPoliticalSocialProfiles.find(
              (psp) => psp.residentProfileId === p.id,
            ) || null;
          return p;
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
          let list = dbResidentProfiles.map((r) => ({
            ...r,
            politicalSocialProfile:
              dbPoliticalSocialProfiles.find(
                (psp) => psp.residentProfileId === r.id,
              ) || null,
          }));

          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
          }

          if (where?.politicalSocialProfile === null) {
            list = list.filter((p) => p.politicalSocialProfile === null);
          } else if (
            where?.politicalSocialProfile &&
            typeof where.politicalSocialProfile === 'object' &&
            'partyStatus' in where.politicalSocialProfile
          ) {
            const expectedStatus = (
              where.politicalSocialProfile as { partyStatus: DbPartyStatus }
            ).partyStatus;
            list = list.filter(
              (p) => p.politicalSocialProfile?.partyStatus === expectedStatus,
            );
          }

          if (where?.OR && Array.isArray(where.OR)) {
            list = list.filter((p) =>
              where.OR!.some((cond) => {
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
        count: async ({
          where,
        }: {
          where?: Prisma.ResidentProfileWhereInput;
        }) => {
          let list = dbResidentProfiles.map((r) => ({
            ...r,
            politicalSocialProfile:
              dbPoliticalSocialProfiles.find(
                (psp) => psp.residentProfileId === r.id,
              ) || null,
          }));

          if (where?.neighborhoodId) {
            list = list.filter((p) => p.neighborhoodId === where.neighborhoodId);
          }

          if (where?.politicalSocialProfile === null) {
            list = list.filter((p) => p.politicalSocialProfile === null);
          } else if (
            where?.politicalSocialProfile &&
            typeof where.politicalSocialProfile === 'object' &&
            'partyStatus' in where.politicalSocialProfile
          ) {
            const expectedStatus = (
              where.politicalSocialProfile as { partyStatus: DbPartyStatus }
            ).partyStatus;
            list = list.filter(
              (p) => p.politicalSocialProfile?.partyStatus === expectedStatus,
            );
          }

          if (where?.OR && Array.isArray(where.OR)) {
            list = list.filter((p) =>
              where.OR!.some((cond) => {
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
      },
      politicalSocialProfile: {
        findUnique: async ({
          where,
        }: {
          where: Prisma.PoliticalSocialProfileWhereUniqueInput;
        }) => {
          if (where.residentProfileId) {
            return (
              dbPoliticalSocialProfiles.find(
                (p) => p.residentProfileId === where.residentProfileId,
              ) || null
            );
          }
          if (where.id) {
            return (
              dbPoliticalSocialProfiles.find((p) => p.id === where.id) || null
            );
          }
          return null;
        },
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: Prisma.PoliticalSocialProfileWhereUniqueInput;
          create: Prisma.PoliticalSocialProfileUncheckedCreateInput;
          update: Prisma.PoliticalSocialProfileUncheckedUpdateInput;
        }) => {
          const index = dbPoliticalSocialProfiles.findIndex(
            (p) => p.residentProfileId === where.residentProfileId,
          );

          if (index >= 0) {
            const existing = dbPoliticalSocialProfiles[index]!;
            const updated: PoliticalSocialProfile = {
              ...existing,
              partyStatus: (update.partyStatus as DbPartyStatus) ?? existing.partyStatus,
              partyAdmissionDate:
                update.partyAdmissionDate !== undefined
                  ? update.partyAdmissionDate
                    ? new Date(update.partyAdmissionDate as string)
                    : null
                  : existing.partyAdmissionDate,
              highestEducation:
                update.highestEducation !== undefined
                  ? (update.highestEducation as DbHighestEducation) || null
                  : existing.highestEducation,
              specialty:
                update.specialty !== undefined
                  ? (update.specialty as string) || null
                  : existing.specialty,
              officialOccupation:
                update.officialOccupation !== undefined
                  ? (update.officialOccupation as string) || null
                  : existing.officialOccupation,
              strengths:
                update.strengths !== undefined
                  ? (update.strengths as string) || null
                  : existing.strengths,
              notes:
                update.notes !== undefined
                  ? (update.notes as string) || null
                  : existing.notes,
              updatedAt: new Date(),
            };
            dbPoliticalSocialProfiles[index] = updated;
            return updated;
          }

          const created: PoliticalSocialProfile = {
            id: randomUUID(),
            residentProfileId: create.residentProfileId,
            partyStatus: create.partyStatus ?? DbPartyStatus.not_member,
            partyAdmissionDate: create.partyAdmissionDate
              ? new Date(create.partyAdmissionDate as string)
              : null,
            highestEducation:
              (create.highestEducation as DbHighestEducation) || null,
            specialty: (create.specialty as string) || null,
            officialOccupation: (create.officialOccupation as string) || null,
            strengths: (create.strengths as string) || null,
            notes: (create.notes as string) || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          dbPoliticalSocialProfiles.push(created);
          return created;
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
        phoneEncrypted: cryptoService.encrypt('+84900000010'),
        phoneHash: cryptoService.hashPhone('+84900000010'),
        fullName: 'Cư Dân Thường',
        role: Role.resident,
        status: DbAccountStatus.active,
        neighborhoodId: dbNeighborhoods[0]!.id,
      },
    });

    const leader1Acc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('+84900000011'),
        phoneHash: cryptoService.hashPhone('+84900000011'),
        fullName: 'Trưởng Khu Phố 1',
        role: Role.leader,
        status: DbAccountStatus.active,
        neighborhoodId: dbNeighborhoods[0]!.id,
      },
    });

    const leader2Acc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('+84900000012'),
        phoneHash: cryptoService.hashPhone('+84900000012'),
        fullName: 'Trưởng Khu Phố 2',
        role: Role.leader,
        status: DbAccountStatus.active,
        neighborhoodId: dbNeighborhoods[1]!.id,
      },
    });

    const officerAcc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('+84900000013'),
        phoneHash: cryptoService.hashPhone('+84900000013'),
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

    // Seed households and resident profiles
    const hh1 = await mockPrisma.household.create({
      data: {
        code: 'HK-KP1-101',
        neighborhoodId: dbNeighborhoods[0]!.id,
        address: '101 Lê Lợi, KP1',
      },
    });

    const hh2 = await mockPrisma.household.create({
      data: {
        code: 'HK-KP2-201',
        neighborhoodId: dbNeighborhoods[1]!.id,
        address: '201 Hai Bà Trưng, KP2',
      },
    });

    // Resident 1 in KP-01 (born 1985-05-15)
    dbResidentProfiles.push({
      id: '11111111-1111-4111-8111-111111111111',
      fullName: 'Nguyễn Văn Minh',
      citizenIdEncrypted: cryptoService.encrypt('001085000001'),
      citizenIdHash: cryptoService.hashCitizenId('001085000001'),
      citizenIdIssueDate: new Date('2021-01-01'),
      birthDate: new Date('1985-05-15'),
      gender: DbGender.male,
      placeOfBirth: 'Hà Nội',
      relationshipToHead: 'Chủ hộ',
      phoneEncrypted: cryptoService.encrypt('+84911111111'),
      emailEncrypted: cryptoService.encrypt('minh@example.com'),
      occupation: 'Giảng viên đại học',
      permanentAddress: '101 Lê Lợi, KP1',
      currentAddress: '101 Lê Lợi, KP1',
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: hh1.id,
      neighborhoodId: dbNeighborhoods[0]!.id,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      household: hh1,
      neighborhood: dbNeighborhoods[0]!,
      politicalSocialProfile: null,
    });

    // Resident 2 in KP-01 (born 1992-08-20)
    dbResidentProfiles.push({
      id: '22222222-2222-4222-8222-222222222222',
      fullName: 'Lê Thị Hoa',
      citizenIdEncrypted: cryptoService.encrypt('001092000002'),
      citizenIdHash: cryptoService.hashCitizenId('001092000002'),
      citizenIdIssueDate: new Date('2021-01-01'),
      birthDate: new Date('1992-08-20'),
      gender: DbGender.female,
      placeOfBirth: 'Hà Nội',
      relationshipToHead: 'Vợ',
      phoneEncrypted: cryptoService.encrypt('+84922222222'),
      emailEncrypted: cryptoService.encrypt('hoa@example.com'),
      occupation: 'Kế toán',
      permanentAddress: '101 Lê Lợi, KP1',
      currentAddress: '101 Lê Lợi, KP1',
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: hh1.id,
      neighborhoodId: dbNeighborhoods[0]!.id,
      createdAt: new Date('2026-01-02'),
      updatedAt: new Date('2026-01-02'),
      household: hh1,
      neighborhood: dbNeighborhoods[0]!,
      politicalSocialProfile: null,
    });

    // Resident 3 in KP-02 (born 1990-10-10)
    dbResidentProfiles.push({
      id: '33333333-3333-4333-8333-333333333333',
      fullName: 'Phạm Đức Dũng',
      citizenIdEncrypted: cryptoService.encrypt('001090000003'),
      citizenIdHash: cryptoService.hashCitizenId('001090000003'),
      citizenIdIssueDate: new Date('2021-01-01'),
      birthDate: new Date('1990-10-10'),
      gender: DbGender.male,
      placeOfBirth: 'Đà Nẵng',
      relationshipToHead: 'Chủ hộ',
      phoneEncrypted: cryptoService.encrypt('+84933333333'),
      emailEncrypted: cryptoService.encrypt('dung@example.com'),
      occupation: 'Bác sĩ',
      permanentAddress: '201 Hai Bà Trưng, KP2',
      currentAddress: '201 Hai Bà Trưng, KP2',
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: hh2.id,
      neighborhoodId: dbNeighborhoods[1]!.id,
      createdAt: new Date('2026-01-03'),
      updatedAt: new Date('2026-01-03'),
      household: hh2,
      neighborhood: dbNeighborhoods[1]!,
      politicalSocialProfile: null,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get('/api/political-social-profiles')
        .expect(401);

      await request(app.getHttpServer())
        .put('/api/political-social-profiles/11111111-1111-4111-8111-111111111111')
        .send({
          partyStatus: PartyStatus.NOT_MEMBER,
        })
        .expect(401);
    });

    it('should return 403 when resident attempts access', async () => {
      await request(app.getHttpServer())
        .get('/api/political-social-profiles')
        .set('Cookie', [residentCookie])
        .expect(403);

      await request(app.getHttpServer())
        .put('/api/political-social-profiles/11111111-1111-4111-8111-111111111111')
        .set('Cookie', [residentCookie])
        .set('Origin', 'http://localhost:3000')
        .send({
          partyStatus: PartyStatus.NOT_MEMBER,
        })
        .expect(403);
    });
  });

  describe('Scoped Listing & Privacy', () => {
    it('should restrict Leader 1 to KP-01 residents only and include not-updated status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/political-social-profiles')
        .set('Cookie', [leader1Cookie])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.total).toBe(2);
      expect(
        res.body.data.items.every(
          (i: { neighborhoodId: string }) =>
            i.neighborhoodId === dbNeighborhoods[0]!.id,
        ),
      ).toBe(true);

      // Verify privacy: no citizenId, maskedCitizenId, phone, or email exposed
      const item = res.body.data.items[0];
      expect(item.citizenId).toBeUndefined();
      expect(item.maskedCitizenId).toBeUndefined();
      expect(item.phoneNumber).toBeUndefined();
      expect(item.maskedPhone).toBeUndefined();
      expect(item.email).toBeUndefined();
      expect(item.maskedEmail).toBeUndefined();
      expect(item.citizenIdEncrypted).toBeUndefined();

      // Verify un-updated profile is represented as null
      expect(item.politicalSocialProfile).toBeNull();
    });

    it('should allow Officer to view all ward residents and filter by neighborhood', async () => {
      const allRes = await request(app.getHttpServer())
        .get('/api/political-social-profiles')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(allRes.body.data.total).toBe(3);

      const filterRes = await request(app.getHttpServer())
        .get(`/api/political-social-profiles?neighborhoodId=${dbNeighborhoods[1]!.id}`)
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(filterRes.body.data.total).toBe(1);
      expect(filterRes.body.data.items[0].fullName).toBe('Phạm Đức Dũng');
    });

    it('should support search by full name and household code', async () => {
      const searchName = await request(app.getHttpServer())
        .get('/api/political-social-profiles?search=Minh')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(searchName.body.data.items.length).toBe(1);
      expect(searchName.body.data.items[0].fullName).toBe('Nguyễn Văn Minh');

      const searchHh = await request(app.getHttpServer())
        .get('/api/political-social-profiles?search=HK-KP2-201')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(searchHh.body.data.items.length).toBe(1);
      expect(searchHh.body.data.items[0].fullName).toBe('Phạm Đức Dũng');
    });
  });

  describe('Validation & Upsert Persistence', () => {
    it('should allow Leader 1 to upsert party_member profile with valid admission date', async () => {
      const residentId = '11111111-1111-4111-8111-111111111111';

      const payload = {
        partyStatus: PartyStatus.PARTY_MEMBER,
        partyAdmissionDate: '2010-05-19T00:00:00.000Z',
        highestEducation: HighestEducation.DOCTORATE,
        specialty: 'Công nghệ thông tin & Viễn thông',
        officialOccupation: 'Phó Giáo sư, Giảng viên cao cấp',
        strengths: 'Nghiên cứu khoa học, bồi dưỡng nhân tài',
        notes: 'Đảng viên gương mẫu, hoàn thành xuất sắc nhiệm vụ',
      };

      const res = await request(app.getHttpServer())
        .put(`/api/political-social-profiles/${residentId}`)
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.partyStatus).toBe(PartyStatus.PARTY_MEMBER);
      expect(res.body.data.partyAdmissionDate).toBe('2010-05-19T00:00:00.000Z');
      expect(res.body.data.highestEducation).toBe(HighestEducation.DOCTORATE);
      expect(res.body.data.specialty).toBe('Công nghệ thông tin & Viễn thông');

      // Verify the list now returns this updated record
      const listRes = await request(app.getHttpServer())
        .get('/api/political-social-profiles')
        .set('Cookie', [leader1Cookie])
        .expect(200);

      const found = listRes.body.data.items.find(
        (i: { id: string }) => i.id === residentId,
      );
      expect(found.politicalSocialProfile).not.toBeNull();
      expect(found.politicalSocialProfile.partyStatus).toBe(
        PartyStatus.PARTY_MEMBER,
      );
    });

    it('should reject party_member without admission date with 400 Bad Request', async () => {
      const residentId = '22222222-2222-4222-8222-222222222222';

      const invalidPayload = {
        partyStatus: PartyStatus.PARTY_MEMBER,
        // partyAdmissionDate missing
        highestEducation: HighestEducation.BACHELOR,
      };

      const res = await request(app.getHttpServer())
        .put(`/api/political-social-profiles/${residentId}`)
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(invalidPayload)
        .expect(400);

      expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should reject future admission date with 400 Bad Request', async () => {
      const residentId = '22222222-2222-4222-8222-222222222222';

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);

      const invalidPayload = {
        partyStatus: PartyStatus.PARTY_MEMBER,
        partyAdmissionDate: futureDate.toISOString(),
      };

      const res = await request(app.getHttpServer())
        .put(`/api/political-social-profiles/${residentId}`)
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(invalidPayload)
        .expect(400);

      expect(res.body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should clear admission date to null when changing from party_member to under_consideration', async () => {
      const residentId = '11111111-1111-4111-8111-111111111111';

      const updatePayload = {
        partyStatus: PartyStatus.UNDER_CONSIDERATION,
        partyAdmissionDate: '2010-05-19T00:00:00.000Z', // stale date should be purged
        highestEducation: HighestEducation.DOCTORATE,
      };

      const res = await request(app.getHttpServer())
        .put(`/api/political-social-profiles/${residentId}`)
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(updatePayload)
        .expect(200);

      expect(res.body.data.partyStatus).toBe(PartyStatus.UNDER_CONSIDERATION);
      expect(res.body.data.partyAdmissionDate).toBeNull();
    });

    it('should reject Leader 2 attempting to upsert resident in KP-01 with 403 Forbidden', async () => {
      const residentId = '11111111-1111-4111-8111-111111111111';

      const payload = {
        partyStatus: PartyStatus.NOT_MEMBER,
      };

      const res = await request(app.getHttpServer())
        .put(`/api/political-social-profiles/${residentId}`)
        .set('Cookie', [leader2Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(403);

      expect(res.body.errorCode).toBe(ErrorCode.FORBIDDEN);
    });

    it('should allow Officer to upsert resident in KP-02', async () => {
      const residentId = '33333333-3333-4333-8333-333333333333';

      const payload = {
        partyStatus: PartyStatus.NOT_MEMBER,
        highestEducation: HighestEducation.MASTER,
        specialty: 'Y học cổ truyền',
        officialOccupation: 'Bác sĩ điều trị',
        strengths: 'Khám chữa bệnh miễn phí cho người nghèo',
      };

      const res = await request(app.getHttpServer())
        .put(`/api/political-social-profiles/${residentId}`)
        .set('Cookie', [officerCookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.partyStatus).toBe(PartyStatus.NOT_MEMBER);
      expect(res.body.data.specialty).toBe('Y học cổ truyền');
    });
  });

  describe('Filtering by Party Status', () => {
    it('should reject an unsupported party-status filter', async () => {
      await request(app.getHttpServer())
        .get('/api/political-social-profiles?partyStatus=unsupported')
        .set('Cookie', [officerCookie])
        .expect(400);
    });

    it('should filter by not_updated party status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/political-social-profiles?partyStatus=not_updated')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].fullName).toBe('Lê Thị Hoa');
    });

    it('should filter by under_consideration party status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/political-social-profiles?partyStatus=${PartyStatus.UNDER_CONSIDERATION}`)
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].fullName).toBe('Nguyễn Văn Minh');
    });
  });
});
