import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Account, Neighborhood, Prisma, Role, AccountStatus as DbAccountStatus } from '@prisma/client';
import { AccountStatus, UserRole } from '@quanlykhupho/shared-types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { RabbitMQService } from '../src/rabbitmq/rabbitmq.service';
import { CryptoService } from '../src/security/crypto.service';
import { OtpService } from '../src/auth/otp.service';
import { HttpExceptionFilter } from '../src/core/exceptions/http-exception.filter';
import { TransformInterceptor } from '../src/core/interceptors/transform.interceptor';

type DbMockAccount = Account & {
  neighborhood: Neighborhood | null;
};

describe('Auth & Account Lifecycle (e2e)', () => {
  let app: INestApplication;
  let otpService: OtpService;
  let rabbitmqService: RabbitMQService;
  let cryptoService: CryptoService;
  let redisService: RedisService;

  // In-memory persistent database for e2e tests
  const dbAccounts: DbMockAccount[] = [];
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

  beforeAll(async () => {
    const mockPrisma = {
      $connect: async () => {},
      $disconnect: async () => {},
      neighborhood: {
        findMany: async () => dbNeighborhoods,
        findUnique: async ({ where }: { where: Prisma.NeighborhoodWhereUniqueInput }) =>
          dbNeighborhoods.find((n) => n.id === where.id) || null,
        count: async () => dbNeighborhoods.length,
      },
      account: {
        findMany: async ({ where }: { where?: Prisma.AccountWhereInput }) => {
          return dbAccounts.filter((acc) => {
            if (where?.role && acc.role !== where.role) return false;
            if (where?.status && acc.status !== where.status) return false;
            if (
              where?.neighborhoodId &&
              acc.neighborhoodId !== where.neighborhoodId
            )
              return false;
            return true;
          });
        },
        findUnique: async ({ where }: { where: Prisma.AccountWhereUniqueInput }) => {
          if (where.id) return dbAccounts.find((a) => a.id === where.id) || null;
          if (where.phoneHash)
            return (
              dbAccounts.find((a) => a.phoneHash === where.phoneHash) || null
            );
          return null;
        },
        create: async ({ data }: { data: Prisma.AccountUncheckedCreateInput }) => {
          const newAcc: DbMockAccount = {
            id: '99999999-9999-4999-9999-' + String(dbAccounts.length + 1).padStart(12, '0'),
            phoneEncrypted: data.phoneEncrypted,
            phoneHash: data.phoneHash,
            fullName: data.fullName,
            role: data.role ?? Role.resident,
            status: data.status ?? DbAccountStatus.pending,
            address: data.address ?? null,
            neighborhoodId: data.neighborhoodId ?? null,
            neighborhood:
              dbNeighborhoods.find((n) => n.id === data.neighborhoodId) || null,
            rejectionReason: data.rejectionReason ?? null,
            lockReason: data.lockReason ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          dbAccounts.push(newAcc);
          return newAcc;
        },
        update: async ({
          where,
          data,
        }: {
          where: Prisma.AccountWhereUniqueInput;
          data: Prisma.AccountUpdateInput;
        }) => {
          const acc = dbAccounts.find((a) => a.id === where.id);
          if (!acc) throw new Error('Account not found');
          Object.assign(acc, data, { updatedAt: new Date() });
          return acc;
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

    otpService = app.get(OtpService);
    rabbitmqService = app.get(RabbitMQService);
    cryptoService = app.get(CryptoService);
    redisService = app.get(RedisService);

    // Pin deterministic OTP for test
    otpService.setOtpGenerator(() => '123456');

    // Create a seed Leader in KP-01
    const leaderPhone = '+84988881111';
    dbAccounts.push({
      id: '11111111-1111-4111-1111-111111111111',
      phoneEncrypted: cryptoService.encrypt(leaderPhone),
      phoneHash: cryptoService.hashPhone(leaderPhone),
      fullName: 'Trưởng Khu Phố 1',
      role: Role.leader,
      status: DbAccountStatus.active,
      address: 'Văn phòng KP1',
      neighborhoodId: dbNeighborhoods[0]?.id ?? null,
      neighborhood: dbNeighborhoods[0] ?? null,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a seed Officer
    const officerPhone = '+84977772222';
    dbAccounts.push({
      id: '22222222-2222-4222-2222-222222222222',
      phoneEncrypted: cryptoService.encrypt(officerPhone),
      phoneHash: cryptoService.hashPhone(officerPhone),
      fullName: 'Cán Bộ Phường',
      role: Role.officer,
      status: DbAccountStatus.active,
      address: 'UBND Phường',
      neighborhoodId: null,
      neighborhood: null,
      rejectionReason: null,
      lockReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Registration Flow for New Resident', () => {
    const residentPhone = '0912345678';
    let registerToken: string;
    let createdResidentId: string;

    it('POST /api/auth/send-otp -> receives 200 with expiresIn: 300 and retryAfter: 60', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/send-otp')
        .send({ phoneNumber: residentPhone })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.expiresIn).toBe(300);
      expect(res.body.data.retryAfter).toBe(60);

      // Verify RabbitMQ queue has encrypted command without plaintext phone/OTP
      const lastMsg = rabbitmqService.publishedMessages.at(-1);
      expect(lastMsg?.queue).toBe('sms_commands');
      expect(lastMsg?.content).not.toContain('0912345678');
      expect(lastMsg?.content).not.toContain('123456');
    });

    it('POST /api/auth/verify-otp -> returns isRegistered: false and single-use registerToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phoneNumber: residentPhone, otpCode: '123456' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isRegistered).toBe(false);
      expect(res.body.data.registerToken).toBeDefined();
      expect(res.body.data.user).toBeNull();

      registerToken = res.body.data.registerToken;
    });

    it('POST /api/auth/register -> creates pending resident account in KP-01', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          registerToken,
          fullName: 'Nguyễn Văn Cư Dân',
          address: 'Số 10 đường Đồng Khởi',
          neighborhoodId: dbNeighborhoods[0]?.id,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.fullName).toBe('Nguyễn Văn Cư Dân');
      expect(res.body.data.user.role).toBe(UserRole.RESIDENT);
      expect(res.body.data.user.status).toBe(AccountStatus.PENDING);
      expect(res.body.data.user.maskedPhone).toBe('091***5678');

      createdResidentId = res.body.data.user.id;
    });

    it('POST /api/auth/register -> replay with consumed token must fail with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          registerToken,
          fullName: 'Nguyễn Văn Cư Dân Fake',
          address: 'Số 10 đường Đồng Khởi',
          neighborhoodId: dbNeighborhoods[0]?.id,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_REGISTER_TOKEN');
    });

    it('Pending resident login attempt -> rejected with 403 ACCOUNT_PENDING and no session cookie', async () => {
      // Clear rate limit window for test
      const phoneHash = cryptoService.hashPhone('+84912345678');
      await redisService.del(`otp:rate_limit:${phoneHash}`);

      await request(app.getHttpServer())
        .post('/api/auth/send-otp')
        .send({ phoneNumber: residentPhone })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phoneNumber: residentPhone, otpCode: '123456' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ACCOUNT_PENDING');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    describe('2. Leader Moderation & Scoping', () => {
      let leaderCookie: string;

      it('Leader login via OTP -> receives HttpOnly session cookie', async () => {
        await request(app.getHttpServer())
          .post('/api/auth/send-otp')
          .send({ phoneNumber: '0988881111' })
          .expect(200);

        const res = await request(app.getHttpServer())
          .post('/api/auth/verify-otp')
          .send({ phoneNumber: '0988881111', otpCode: '123456' })
          .expect(200);

        expect(res.body.data.isRegistered).toBe(true);
        expect(res.body.data.user.role).toBe(UserRole.LEADER);
        expect(res.headers['set-cookie']).toBeDefined();

        const cookieHeader = res.headers['set-cookie'];
        leaderCookie = Array.isArray(cookieHeader) ? cookieHeader[0] : (cookieHeader as string);
      });

      it('GET /api/users/pending -> Leader sees only pending residents in their neighborhood (KP-01)', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/users/pending')
          .set('Cookie', leaderCookie)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].id).toBe(createdResidentId);
      });

      it('Leader approves pending resident in KP-01 -> resident status becomes ACTIVE', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/api/users/${createdResidentId}/approve`)
          .set('Cookie', leaderCookie)
          .set('Origin', 'http://localhost:3000')
          .expect(200);

        expect(res.body.data.status).toBe(AccountStatus.ACTIVE);
      });
    });

    describe('3. Active Resident Session & Lock Revocation', () => {
      let residentCookie: string;

      it('Active resident logs in -> receives session and accesses GET /api/auth/me', async () => {
        // Reset rate limit key for resident phone
        const phoneHash = cryptoService.hashPhone('+84912345678');
        await redisService.del(`otp:rate_limit:${phoneHash}`);

        await request(app.getHttpServer())
          .post('/api/auth/send-otp')
          .send({ phoneNumber: residentPhone })
          .expect(200);

        const loginRes = await request(app.getHttpServer())
          .post('/api/auth/verify-otp')
          .send({ phoneNumber: residentPhone, otpCode: '123456' })
          .expect(200);

        expect(loginRes.body.data.isRegistered).toBe(true);
        expect(loginRes.body.data.user.status).toBe(AccountStatus.ACTIVE);

        const cookieHeader = loginRes.headers['set-cookie'];
        residentCookie = Array.isArray(cookieHeader) ? cookieHeader[0] : (cookieHeader as string);

        // Access /api/auth/me
        const meRes = await request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Cookie', residentCookie)
          .expect(200);

        expect(meRes.body.data.user.fullName).toBe('Nguyễn Văn Cư Dân');
        expect(meRes.body.data.user.maskedPhone).toBe('091***5678');
        expect(meRes.headers['set-cookie']).toBeDefined();
        expect(String(meRes.headers['set-cookie'])).toContain(
          'Max-Age=604800',
        );
      });

      it('Leader locks resident with reason -> resident session is revoked, subsequent requests fail and re-login returns 403', async () => {
        // Leader logs in
        const leaderPhoneHash = cryptoService.hashPhone('+84988881111');
        await redisService.del(`otp:rate_limit:${leaderPhoneHash}`);

        await request(app.getHttpServer())
          .post('/api/auth/send-otp')
          .send({ phoneNumber: '0988881111' })
          .expect(200);

        const leaderRes = await request(app.getHttpServer())
          .post('/api/auth/verify-otp')
          .send({ phoneNumber: '0988881111', otpCode: '123456' })
          .expect(200);

        const cookieHeader = leaderRes.headers['set-cookie'];
        const currentLeaderCookie = Array.isArray(cookieHeader) ? cookieHeader[0] : (cookieHeader as string);

        // Leader locks resident
        await request(app.getHttpServer())
          .patch(`/api/users/${createdResidentId}/lock`)
          .set('Cookie', currentLeaderCookie)
          .set('Origin', 'http://localhost:3000')
          .send({ reason: 'Tạm khóa để xác minh nhân khẩu' })
          .expect(200);

        // Resident tries to access /api/auth/me with previous cookie -> Rejected with 401 UNAUTHORIZED (session revoked from Redis)
        const meRes = await request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Cookie', residentCookie)
          .expect(401);

        expect(meRes.body.errorCode).toBe('UNAUTHORIZED');

        // Resident tries to login again via OTP -> Rejected with 403 ACCOUNT_LOCKED
        const residentPhoneHash = cryptoService.hashPhone('+84912345678');
        await redisService.del(`otp:rate_limit:${residentPhoneHash}`);

        await request(app.getHttpServer())
          .post('/api/auth/send-otp')
          .send({ phoneNumber: residentPhone })
          .expect(200);

        const lockedLoginRes = await request(app.getHttpServer())
          .post('/api/auth/verify-otp')
          .send({ phoneNumber: residentPhone, otpCode: '123456' })
          .expect(403);

        expect(lockedLoginRes.body.errorCode).toBe('ACCOUNT_LOCKED');
      });
    });

    describe('4. Officer Leader Creation & CSRF Protection', () => {
      let officerCookie: string;

      it('Officer creates a new Leader for KP-02', async () => {
        const officerPhoneHash = cryptoService.hashPhone('+84977772222');
        await redisService.del(`otp:rate_limit:${officerPhoneHash}`);

        await request(app.getHttpServer())
          .post('/api/auth/send-otp')
          .send({ phoneNumber: '0977772222' })
          .expect(200);

        const officerLogin = await request(app.getHttpServer())
          .post('/api/auth/verify-otp')
          .send({ phoneNumber: '0977772222', otpCode: '123456' })
          .expect(200);

        const cookieHeader = officerLogin.headers['set-cookie'];
        officerCookie = Array.isArray(cookieHeader) ? cookieHeader[0] : (cookieHeader as string);

        const res = await request(app.getHttpServer())
          .post('/api/users/leaders')
          .set('Cookie', officerCookie)
          .set('Origin', 'http://localhost:3000')
          .send({
            phoneNumber: '0966554433',
            fullName: 'Trưởng Khu Phố 2 Mới',
            neighborhoodId: dbNeighborhoods[1]?.id,
          })
          .expect(201);

        expect(res.body.data.role).toBe(UserRole.LEADER);
        expect(res.body.data.status).toBe(AccountStatus.ACTIVE);
      });

      it('CSRF Protection: request with untrusted origin must be rejected with 403 CSRF_ERROR', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/users/leaders')
          .set('Cookie', officerCookie)
          .set('Origin', 'http://malicious-site.com')
          .send({
            phoneNumber: '0933333333',
            fullName: 'Attacker Leader',
            neighborhoodId: dbNeighborhoods[0]?.id,
          })
          .expect(403);

        expect(res.body.errorCode).toBe('CSRF_ERROR');
      });

      it('CSRF Protection: cookie-auth mutation without Origin/Referer is rejected', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/users/leaders')
          .set('Cookie', officerCookie)
          .send({
            phoneNumber: '0933333334',
            fullName: 'Thiếu Origin',
            neighborhoodId: dbNeighborhoods[0]?.id,
          })
          .expect(403);

        expect(res.body.errorCode).toBe('CSRF_ERROR');
      });
    });
  });
});
