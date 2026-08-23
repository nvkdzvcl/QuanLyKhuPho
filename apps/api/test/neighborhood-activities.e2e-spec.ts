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
  NeighborhoodActivityParticipant,
  PoliticalSocialProfile,
  Prisma,
  ResidentProfile,
  Role,
  AccountStatus as DbAccountStatus,
  ActivityFilterCondition as DbActivityFilterCondition,
  AttendanceStatus as DbAttendanceStatus,
  ActivityRating as DbActivityRating,
  PartyStatus as DbPartyStatus,
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
  ActivityFilterCondition,
  ActivityParticipantDto,
  ActivityRating,
  AttendanceStatus,
  ErrorCode,
  NeighborhoodActivityDto,
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

type DbMockActivity = NeighborhoodActivity & {
  neighborhood: Neighborhood | null;
  createdBy: Account | null;
  participants: (NeighborhoodActivityParticipant & {
    residentProfile: ResidentProfile;
  })[];
};

describe('Neighborhood Activities Workflow (e2e)', () => {
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
  const dbActivities: DbMockActivity[] = [];
  const dbParticipants: (NeighborhoodActivityParticipant & {
    residentProfile: ResidentProfile;
  })[] = [];

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
        }) => (where.id ? dbHouseholds.find((h) => h.id === where.id) || null : null),
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
        }) => dbResidentProfiles.find((r) => r.id === where.id) || null,
        findMany: async ({
          where,
        }: {
          where?: Prisma.ResidentProfileWhereInput;
        }) => {
          let list = [...dbResidentProfiles];
          if (where?.neighborhoodId) {
            list = list.filter((r) => r.neighborhoodId === where.neighborhoodId);
          }
          return list;
        },
      },
      neighborhoodActivity: {
        findUnique: async ({
          where,
        }: {
          where: Prisma.NeighborhoodActivityWhereUniqueInput;
        }) => {
          const act = dbActivities.find((a) => a.id === where.id) || null;
          if (!act) return null;
          act.participants = dbParticipants.filter((p) => p.activityId === act.id);
          return act;
        },
        findMany: async ({
          where,
          skip,
          take,
        }: {
          where?: Prisma.NeighborhoodActivityWhereInput;
          skip?: number;
          take?: number;
        }) => {
          let list = dbActivities.map((a) => ({
            ...a,
            participants: dbParticipants.filter((p) => p.activityId === a.id),
          }));

          if (where?.neighborhoodId) {
            list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
          }

          if (where?.activityDate && typeof where.activityDate === 'object') {
            const actCond = where.activityDate as { gte?: Date; lt?: Date };
            if (actCond.gte) {
              list = list.filter((a) => a.activityDate >= actCond.gte!);
            }
            if (actCond.lt) {
              list = list.filter((a) => a.activityDate < actCond.lt!);
            }
          }

          list.sort((a, b) => b.activityDate.getTime() - a.activityDate.getTime());
          const s = skip || 0;
          const t = take || list.length;
          return list.slice(s, s + t);
        },
        count: async ({
          where,
        }: {
          where?: Prisma.NeighborhoodActivityWhereInput;
        }) => {
          let list = [...dbActivities];
          if (where?.neighborhoodId) {
            list = list.filter((a) => a.neighborhoodId === where.neighborhoodId);
          }
          if (where?.activityDate && typeof where.activityDate === 'object') {
            const actCond = where.activityDate as { gte?: Date; lt?: Date };
            if (actCond.gte) {
              list = list.filter((a) => a.activityDate >= actCond.gte!);
            }
            if (actCond.lt) {
              list = list.filter((a) => a.activityDate < actCond.lt!);
            }
          }
          return list.length;
        },
        create: async ({
          data,
        }: {
          data: Prisma.NeighborhoodActivityUncheckedCreateInput;
        }) => {
          const neighborhood =
            dbNeighborhoods.find((n) => n.id === data.neighborhoodId) || null;
          const createdBy =
            dbAccounts.find((a) => a.id === data.createdById) || null;

          const created: DbMockActivity = {
            id: randomUUID(),
            neighborhoodId: data.neighborhoodId,
            createdById: data.createdById,
            name: data.name,
            activityDate: new Date(data.activityDate as string | Date),
            description: (data.description as string) ?? null,
            personInCharge: (data.personInCharge as string) ?? null,
            filterCondition:
              data.filterCondition ?? DbActivityFilterCondition.all,
            createdAt: new Date(),
            updatedAt: new Date(),
            neighborhood,
            createdBy,
            participants: [],
          };
          dbActivities.push(created);
          return created;
        },
        update: async ({
          where,
          data,
        }: {
          where: Prisma.NeighborhoodActivityWhereUniqueInput;
          data: Prisma.NeighborhoodActivityUncheckedUpdateInput;
        }) => {
          const act = dbActivities.find((a) => a.id === where.id);
          if (!act) throw new Error('Activity not found');

          if (data.name !== undefined) act.name = data.name as string;
          if (data.activityDate !== undefined)
            act.activityDate = new Date(data.activityDate as string | Date);
          if (data.description !== undefined)
            act.description = data.description as string | null;
          if (data.personInCharge !== undefined)
            act.personInCharge = data.personInCharge as string | null;
          act.updatedAt = new Date();
          return act;
        },
      },
      neighborhoodActivityParticipant: {
        findMany: async ({
          where,
        }: {
          where?: Prisma.NeighborhoodActivityParticipantWhereInput;
        }) => {
          let list = [...dbParticipants];
          if (where?.activityId) {
            list = list.filter((p) => p.activityId === where.activityId);
          }
          return list;
        },
        createMany: async ({
          data,
        }: {
          data: Prisma.NeighborhoodActivityParticipantCreateManyInput[];
        }) => {
          for (const item of data) {
            const residentProfile =
              dbResidentProfiles.find((r) => r.id === item.residentProfileId)!;
            dbParticipants.push({
              id: randomUUID(),
              activityId: item.activityId,
              residentProfileId: item.residentProfileId,
              attendance: item.attendance ?? DbAttendanceStatus.unconfirmed,
              notes: item.notes ?? null,
              rating: item.rating ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
              residentProfile,
            });
          }
          return { count: data.length };
        },
        update: async ({
          where,
          data,
        }: {
          where: Prisma.NeighborhoodActivityParticipantWhereUniqueInput;
          data: Prisma.NeighborhoodActivityParticipantUncheckedUpdateInput;
        }) => {
          const p = dbParticipants.find((item) => item.id === where.id);
          if (!p) throw new Error('Participant not found');
          if (data.attendance !== undefined)
            p.attendance = data.attendance as DbAttendanceStatus;
          if (data.notes !== undefined) p.notes = data.notes as string | null;
          if (data.rating !== undefined)
            p.rating = (data.rating as DbActivityRating) || null;
          p.updatedAt = new Date();
          return p;
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

    // Create user accounts
    const residentAcc = await mockPrisma.account.create({
      data: {
        phoneEncrypted: cryptoService.encrypt('+84900000001'),
        phoneHash: cryptoService.hashPhone('+84900000001'),
        fullName: 'Cư Dân Phường',
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

    // Create sessions
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

    // Seed households
    const hh1 = await mockPrisma.household.create({
      data: {
        code: 'HK-01',
        neighborhoodId: dbNeighborhoods[0]!.id,
        address: '101 Lê Lợi, KP1',
      },
    });

    // Seed 4 residents in KP-01:
    // 1. Minor (14 years old on 2026-08-23)
    dbResidentProfiles.push({
      id: 'res-minor-1',
      fullName: 'Nguyễn Văn Bé (14 tuổi)',
      citizenIdEncrypted: cryptoService.encrypt('001112000001'),
      citizenIdHash: cryptoService.hashCitizenId('001112000001'),
      citizenIdIssueDate: null,
      birthDate: new Date('2012-05-15T00:00:00.000Z'),
      gender: DbGender.male,
      placeOfBirth: 'Hà Nội',
      relationshipToHead: 'Con',
      phoneEncrypted: null,
      emailEncrypted: null,
      occupation: 'Học sinh',
      permanentAddress: '101 Lê Lợi, KP1',
      currentAddress: null,
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: hh1.id,
      neighborhoodId: dbNeighborhoods[0]!.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      household: hh1,
      neighborhood: dbNeighborhoods[0]!,
      politicalSocialProfile: null,
    });

    // 2. Exact 18 years old on 2026-08-23
    dbResidentProfiles.push({
      id: 'res-exact18-1',
      fullName: 'Trần Thị Tròn 18 (Đúng 18 tuổi)',
      citizenIdEncrypted: cryptoService.encrypt('001088000002'),
      citizenIdHash: cryptoService.hashCitizenId('001088000002'),
      citizenIdIssueDate: null,
      birthDate: new Date('2008-08-23T00:00:00.000Z'),
      gender: DbGender.female,
      placeOfBirth: 'Hà Nội',
      relationshipToHead: 'Con',
      phoneEncrypted: null,
      emailEncrypted: null,
      occupation: 'Sinh viên',
      permanentAddress: '101 Lê Lợi, KP1',
      currentAddress: null,
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: hh1.id,
      neighborhoodId: dbNeighborhoods[0]!.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      household: hh1,
      neighborhood: dbNeighborhoods[0]!,
      politicalSocialProfile: null,
    });

    // 3. Adult Party Member (36 years old on 2026-08-23)
    dbResidentProfiles.push({
      id: '33333333-3333-4333-8333-333333333333',
      fullName: 'Phạm Văn Đảng (36 tuổi)',
      citizenIdEncrypted: cryptoService.encrypt('001090000003'),
      citizenIdHash: cryptoService.hashCitizenId('001090000003'),
      citizenIdIssueDate: null,
      birthDate: new Date('1990-03-10T00:00:00.000Z'),
      gender: DbGender.male,
      placeOfBirth: 'Hải Phòng',
      relationshipToHead: 'Chủ hộ',
      phoneEncrypted: null,
      emailEncrypted: null,
      occupation: 'Giảng viên',
      permanentAddress: '101 Lê Lợi, KP1',
      currentAddress: null,
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: hh1.id,
      neighborhoodId: dbNeighborhoods[0]!.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      household: hh1,
      neighborhood: dbNeighborhoods[0]!,
      politicalSocialProfile: {
        id: 'psp-1',
        residentProfileId: '33333333-3333-4333-8333-333333333333',
        partyStatus: DbPartyStatus.party_member,
        partyAdmissionDate: new Date('2015-02-03'),
        highestEducation: null,
        specialty: null,
        officialOccupation: null,
        strengths: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 4. Adult Non-Party Member (28 years old on 2026-08-23)
    dbResidentProfiles.push({
      id: '44444444-4444-4444-8444-444444444444',
      fullName: 'Lê Thị Lớn (28 tuổi)',
      citizenIdEncrypted: cryptoService.encrypt('001098000004'),
      citizenIdHash: cryptoService.hashCitizenId('001098000004'),
      citizenIdIssueDate: null,
      birthDate: new Date('1998-07-20T00:00:00.000Z'),
      gender: DbGender.female,
      placeOfBirth: 'TP. Hồ Chí Minh',
      relationshipToHead: 'Vợ',
      phoneEncrypted: null,
      emailEncrypted: null,
      occupation: 'Kế toán',
      permanentAddress: '101 Lê Lợi, KP1',
      currentAddress: null,
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: hh1.id,
      neighborhoodId: dbNeighborhoods[0]!.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      household: hh1,
      neighborhood: dbNeighborhoods[0]!,
      politicalSocialProfile: null,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication & Scoping Guard Tests', () => {
    it('should return 401 Unauthorized when no auth cookie is provided', async () => {
      await request(app.getHttpServer())
        .get('/api/neighborhood-activities/monthly?month=2026-08')
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .send({
          name: 'Họp dân',
          activityDate: '2026-08-23T19:00:00.000Z',
          filterCondition: ActivityFilterCondition.ALL,
        })
        .expect(401);
    });

    it('should return 403 Forbidden when resident attempts access', async () => {
      await request(app.getHttpServer())
        .get('/api/neighborhood-activities/monthly?month=2026-08')
        .set('Cookie', [residentCookie])
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .set('Cookie', [residentCookie])
        .set('Origin', 'http://localhost:3000')
        .send({
          name: 'Họp dân',
          activityDate: '2026-08-23T19:00:00.000Z',
          filterCondition: ActivityFilterCondition.ALL,
        })
        .expect(403);
    });
  });

  describe('Activity Creation & 5 Extraction Modes', () => {
    it('Leader 1 creates activity with filter ALL in KP-01 (extracts all 4 residents)', async () => {
      const payload = {
        name: 'Họp Định Kỳ Toàn Dân Phố',
        activityDate: '2026-08-23T19:00:00.000Z',
        description: 'Triển khai công tác phòng cháy chữa cháy',
        personInCharge: 'Ban điều hành khu phố',
        filterCondition: ActivityFilterCondition.ALL,
      };

      const res = await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.activity.name).toBe('Họp Định Kỳ Toàn Dân Phố');
      expect(res.body.data.activity.personInCharge).toBe(
        'Ban điều hành khu phố',
      );
      expect(res.body.data.activity.neighborhoodId).toBe(dbNeighborhoods[0]!.id);
      expect(res.body.data.activity.totalParticipants).toBe(4);
      expect(res.body.data.activity.participants.length).toBe(4);
      expect(res.body.data.participantCount).toBe(4);
      expect(res.body.data.warning).toBeNull();

      // Verify privacy: participant exposes only safe operational fields
      const p1 = res.body.data.activity.participants[0];
      expect(p1.id).toBeDefined();
      expect(p1.fullName).toBeDefined();
      expect(p1.attendance).toBe(AttendanceStatus.UNCONFIRMED);
      expect(p1.citizenId).toBeUndefined();
      expect(p1.citizenIdEncrypted).toBeUndefined();
      expect(p1.phoneNumber).toBeUndefined();
      expect(p1.maskedPhone).toBeUndefined();
      expect(p1.birthDate).toBeUndefined();
      expect(p1.gender).toBeUndefined();
    });

    it('ignores leader scope spoofing and non-custom resident IDs', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send({
          name: 'Hoạt động đúng phạm vi tổ trưởng',
          activityDate: '2026-08-24',
          filterCondition: ActivityFilterCondition.ALL,
          neighborhoodId: dbNeighborhoods[1]!.id,
          customResidentIds: ['ignored-non-uuid-value'],
        })
        .expect(201);

      expect(res.body.data.activity.neighborhoodId).toBe(
        dbNeighborhoods[0]!.id,
      );
      expect(res.body.data.activity.totalParticipants).toBe(4);
    });

    it('Leader 1 creates activity with filter UNDER_18 (extracts only minor < 18)', async () => {
      const payload = {
        name: 'Sinh Hoạt Thiếu Nhi Hè 2026',
        activityDate: '2026-08-23T08:00:00.000Z',
        description: 'Hoạt động trải nghiệm hè',
        filterCondition: ActivityFilterCondition.UNDER_18,
      };

      const res = await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(201);

      expect(res.body.data.activity.participants.length).toBe(1);
      expect(res.body.data.activity.participants[0].fullName).toContain('14 tuổi');
    });

    it('Leader 1 creates activity with filter OVER_18 (extracts 2 adults > 18, strictly excludes exact 18)', async () => {
      const payload = {
        name: 'Hội Nghị Tiếp Xúc Cử Tri',
        activityDate: '2026-08-23T14:00:00.000Z',
        filterCondition: ActivityFilterCondition.OVER_18,
      };

      const res = await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(201);

      expect(res.body.data.activity.participants.length).toBe(2);
      const names = res.body.data.activity.participants.map(
        (p: ActivityParticipantDto) => p.fullName,
      );
      expect(names).toContain('Phạm Văn Đảng (36 tuổi)');
      expect(names).toContain('Lê Thị Lớn (28 tuổi)');
      expect(names).not.toContain('Trần Thị Tròn 18 (Đúng 18 tuổi)');
      expect(names).not.toContain('Nguyễn Văn Bé (14 tuổi)');
    });

    it('Leader 1 creates activity with filter PARTY_MEMBER (extracts 1 party member)', async () => {
      const payload = {
        name: 'Sinh Hoạt Chi Bộ Khu Phố',
        activityDate: '2026-08-23T09:00:00.000Z',
        filterCondition: ActivityFilterCondition.PARTY_MEMBER,
      };

      const res = await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(201);

      expect(res.body.data.activity.participants.length).toBe(1);
      expect(res.body.data.activity.participants[0].fullName).toContain('Phạm Văn Đảng');
    });

    it('Officer creates activity with filter CUSTOM for specified neighborhood', async () => {
      const payload = {
        name: 'Ban Tổ Chức Tết Trung Thu',
        activityDate: '2026-08-25T19:00:00.000Z',
        filterCondition: ActivityFilterCondition.CUSTOM,
        neighborhoodId: dbNeighborhoods[0]!.id,
        customResidentIds: [
          '33333333-3333-4333-8333-333333333333',
          '44444444-4444-4444-8444-444444444444',
          '33333333-3333-4333-8333-333333333333',
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .set('Cookie', [officerCookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(201);

      expect(res.body.data.activity.participants.length).toBe(2);
      expect(res.body.data.warning).toBeNull();
    });

    it('Officer creates activity with empty custom list and receives warning signal', async () => {
      const payload = {
        name: 'Hoạt Động Không Người',
        activityDate: '2026-08-26T19:00:00.000Z',
        filterCondition: ActivityFilterCondition.CUSTOM,
        neighborhoodId: dbNeighborhoods[0]!.id,
        customResidentIds: [],
      };

      const res = await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .set('Cookie', [officerCookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(201);

      expect(res.body.data.activity.totalParticipants).toBe(0);
      expect(res.body.data.warning).not.toBeNull();
    });

    it('should reject invalid activityDate format with 400 Bad Request', async () => {
      const payload = {
        name: 'Sai ngày',
        activityDate: 'invalid-date',
        filterCondition: ActivityFilterCondition.ALL,
      };

      await request(app.getHttpServer())
        .post('/api/neighborhood-activities')
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(400);
    });
  });

  describe('Monthly Queries & Scoping', () => {
    it('Leader 1 sees all activities in KP-01 for month 2026-08', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/neighborhood-activities/monthly?month=2026-08')
        .set('Cookie', [leader1Cookie])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.month).toBe('2026-08');
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(
        res.body.data.items.every(
          (a: NeighborhoodActivityDto) =>
            a.neighborhoodId === dbNeighborhoods[0]!.id,
        ),
      ).toBe(true);
    });

    it('Leader 2 sees 0 activities in KP-02 for month 2026-08', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/neighborhood-activities/monthly?month=2026-08')
        .set('Cookie', [leader2Cookie])
        .expect(200);

      expect(res.body.data.items.length).toBe(0);
      expect(res.body.data.total).toBe(0);
    });

    it('Officer sees all ward activities for month 2026-08 and can filter by neighborhood', async () => {
      const allRes = await request(app.getHttpServer())
        .get('/api/neighborhood-activities/monthly?month=2026-08')
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(allRes.body.data.total).toBe(dbActivities.length);

      const filterRes = await request(app.getHttpServer())
        .get(`/api/neighborhood-activities/monthly?month=2026-08&neighborhoodId=${dbNeighborhoods[0]!.id}`)
        .set('Cookie', [officerCookie])
        .expect(200);

      expect(filterRes.body.data.total).toBe(dbActivities.length);
    });

    it('should reject invalid month format with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .get('/api/neighborhood-activities/monthly?month=2026/08')
        .set('Cookie', [officerCookie])
        .expect(400);
    });
  });

  describe('Detail, Metadata Update & Batch Participant Updates', () => {
    let testActivityId: string;
    let participant1Id: string;
    let participant2Id: string;

    beforeAll(async () => {
      testActivityId = dbActivities[0]!.id;
      const participants = dbParticipants.filter((p) => p.activityId === testActivityId);
      participant1Id = participants[0]!.id;
      participant2Id = participants[1]!.id;
    });

    it('Leader 1 fetches activity detail successfully', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/neighborhood-activities/${testActivityId}`)
        .set('Cookie', [leader1Cookie])
        .expect(200);

      expect(res.body.data.id).toBe(testActivityId);
      expect(res.body.data.participants.length).toBe(4);
    });

    it('Leader 2 is forbidden from fetching Leader 1 activity detail (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/neighborhood-activities/${testActivityId}`)
        .set('Cookie', [leader2Cookie])
        .expect(403);

      expect(res.body.errorCode).toBe(ErrorCode.FORBIDDEN);
    });

    it('Leader 1 updates metadata (name, description) without regenerating roster', async () => {
      const updatePayload = {
        name: 'Họp Định Kỳ Dân Phố (Đã Đổi Tên)',
        description: 'Mô tả mới được cập nhật',
        personInCharge: 'Tổ trưởng khu phố',
      };

      const res = await request(app.getHttpServer())
        .patch(`/api/neighborhood-activities/${testActivityId}`)
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(updatePayload)
        .expect(200);

      expect(res.body.data.name).toBe('Họp Định Kỳ Dân Phố (Đã Đổi Tên)');
      expect(res.body.data.description).toBe('Mô tả mới được cập nhật');
      expect(res.body.data.personInCharge).toBe('Tổ trưởng khu phố');
      expect(res.body.data.totalParticipants).toBe(4);
    });

    it('Leader 1 batch updates attendance, note, and rating atomically', async () => {
      const batchPayload = {
        participants: [
          {
            participantId: participant1Id,
            attendance: AttendanceStatus.ATTENDED,
            notes: 'Tham gia đầy đủ và tích cực',
            rating: ActivityRating.GOOD,
          },
          {
            participantId: participant2Id,
            attendance: AttendanceStatus.ABSENT,
            notes: 'Bận việc gia đình có xin phép',
            rating: null,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .put(`/api/neighborhood-activities/${testActivityId}/participants`)
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(batchPayload)
        .expect(200);

      expect(res.body.data.attendedCount).toBe(1);
      expect(res.body.data.absentCount).toBe(1);
      expect(res.body.data.unconfirmedCount).toBe(2);

      const p1 = res.body.data.participants.find(
        (p: ActivityParticipantDto) => p.id === participant1Id,
      );
      expect(p1.attendance).toBe(AttendanceStatus.ATTENDED);
      expect(p1.notes).toBe('Tham gia đầy đủ và tích cực');
      expect(p1.rating).toBe(ActivityRating.GOOD);
    });

    it('should reject batch participant update with duplicate IDs (400 DUPLICATE_PARTICIPANT)', async () => {
      const batchPayload = {
        participants: [
          {
            participantId: participant1Id,
            attendance: AttendanceStatus.ATTENDED,
          },
          {
            participantId: participant1Id,
            attendance: AttendanceStatus.ABSENT,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .put(`/api/neighborhood-activities/${testActivityId}/participants`)
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(batchPayload)
        .expect(400);

      expect(res.body.errorCode).toBe(ErrorCode.DUPLICATE_PARTICIPANT);
    });

    it('should reject batch participant update with non-roster ID (400 INVALID_PARTICIPANT)', async () => {
      const batchPayload = {
        participants: [
          {
            participantId: '88888888-9999-4888-8888-888888888888',
            attendance: AttendanceStatus.ATTENDED,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .put(`/api/neighborhood-activities/${testActivityId}/participants`)
        .set('Cookie', [leader1Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(batchPayload)
        .expect(400);

      expect(res.body.errorCode).toBe(ErrorCode.INVALID_PARTICIPANT);
    });

    it('Leader 2 is forbidden from batch updating Leader 1 activity participants (403)', async () => {
      const batchPayload = {
        participants: [
          {
            participantId: participant1Id,
            attendance: AttendanceStatus.ATTENDED,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .put(`/api/neighborhood-activities/${testActivityId}/participants`)
        .set('Cookie', [leader2Cookie])
        .set('Origin', 'http://localhost:3000')
        .send(batchPayload)
        .expect(403);

      expect(res.body.errorCode).toBe(ErrorCode.FORBIDDEN);
    });
  });
});
