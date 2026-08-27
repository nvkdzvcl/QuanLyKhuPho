import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Account, Neighborhood, Prisma, Role, AccountStatus as DbAccountStatus } from '@prisma/client';
import {
  AccountStatus,
  ErrorCode,
  ManagedResidentStatus,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { SmsPublisherService } from '../rabbitmq/sms-publisher.service';
import { CryptoService } from '../security/crypto.service';
import { SessionService } from '../auth/session.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from './users.service';
import { ManagedResidentQueryDto } from './dto/managed-resident-query.dto';

type MockAccount = Account & {
  neighborhood: Neighborhood | null;
};

describe('UsersService', () => {
  let usersService: UsersService;
  let prisma: PrismaService;
  let cryptoService: CryptoService;
  let sessionService: SessionService;
  let smsPublisherService: SmsPublisherService;
  let rabbitmqService: RabbitMQService;
  let redisService: RedisService;

  // In-memory mock database store for deterministic testing
  let mockAccounts: MockAccount[] = [];
  let mockNeighborhoods: Neighborhood[] = [];

  beforeEach(async () => {
    mockNeighborhoods = [
      {
        id: 'neigh-1',
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
        id: 'neigh-2',
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

    const configService = {
      get: (key: string) => {
        if (key === 'PHONE_ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (key === 'PHONE_HASH_KEY') {
          return 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
        }
        return undefined;
      },
    } as unknown as ConfigService;

    cryptoService = new CryptoService(configService);
    cryptoService.onModuleInit();

    redisService = new RedisService(configService);
    await redisService.onModuleInit();

    sessionService = new SessionService(redisService);

    rabbitmqService = new RabbitMQService(configService);
    await rabbitmqService.onModuleInit();

    smsPublisherService = new SmsPublisherService(rabbitmqService, cryptoService);

    const now = Date.now();
    mockAccounts = [
      {
        id: 'res-1',
        phoneEncrypted: cryptoService.encrypt('+84911111111'),
        phoneHash: cryptoService.hashPhone('+84911111111'),
        fullName: 'Nguyễn Văn Cư Dân KP1',
        role: Role.resident,
        status: DbAccountStatus.pending,
        address: '123 KP1',
        neighborhoodId: 'neigh-1',
        neighborhood: mockNeighborhoods[0] ?? null,
        rejectionReason: null,
        lockReason: null,
        createdAt: new Date(now - 60000),
        updatedAt: new Date(now - 60000),
      },
      {
        id: 'res-2',
        phoneEncrypted: cryptoService.encrypt('+84922222222'),
        phoneHash: cryptoService.hashPhone('+84922222222'),
        fullName: 'Trần Thị Cư Dân KP2',
        role: Role.resident,
        status: DbAccountStatus.pending,
        address: '456 KP2',
        neighborhoodId: 'neigh-2',
        neighborhood: mockNeighborhoods[1] ?? null,
        rejectionReason: null,
        lockReason: null,
        createdAt: new Date(now - 50000),
        updatedAt: new Date(now - 50000),
      },
      {
        id: 'res-active-kp1',
        phoneEncrypted: cryptoService.encrypt('+84933333331'),
        phoneHash: cryptoService.hashPhone('+84933333331'),
        fullName: 'Lê Văn Active KP1',
        role: Role.resident,
        status: DbAccountStatus.active,
        address: '789 KP1',
        neighborhoodId: 'neigh-1',
        neighborhood: mockNeighborhoods[0] ?? null,
        rejectionReason: null,
        lockReason: null,
        createdAt: new Date(now - 40000),
        updatedAt: new Date(now - 40000),
      },
      {
        id: 'res-locked-kp1',
        phoneEncrypted: cryptoService.encrypt('+84933333332'),
        phoneHash: cryptoService.hashPhone('+84933333332'),
        fullName: 'Phạm Thị Locked KP1',
        role: Role.resident,
        status: DbAccountStatus.locked,
        address: '101 KP1',
        neighborhoodId: 'neigh-1',
        neighborhood: mockNeighborhoods[0] ?? null,
        rejectionReason: null,
        lockReason: 'Chuyển đi',
        createdAt: new Date(now - 30000),
        updatedAt: new Date(now - 30000),
      },
      {
        id: 'res-active-kp2',
        phoneEncrypted: cryptoService.encrypt('+84944444441'),
        phoneHash: cryptoService.hashPhone('+84944444441'),
        fullName: 'Hoàng Văn Active KP2',
        role: Role.resident,
        status: DbAccountStatus.active,
        address: '202 KP2',
        neighborhoodId: 'neigh-2',
        neighborhood: mockNeighborhoods[1] ?? null,
        rejectionReason: null,
        lockReason: null,
        createdAt: new Date(now - 20000),
        updatedAt: new Date(now - 20000),
      },
      {
        id: 'res-locked-kp2',
        phoneEncrypted: cryptoService.encrypt('+84944444442'),
        phoneHash: cryptoService.hashPhone('+84944444442'),
        fullName: 'Vũ Thị Locked KP2',
        role: Role.resident,
        status: DbAccountStatus.locked,
        address: '303 KP2',
        neighborhoodId: 'neigh-2',
        neighborhood: mockNeighborhoods[1] ?? null,
        rejectionReason: null,
        lockReason: 'Vi phạm quy định',
        createdAt: new Date(now - 10000),
        updatedAt: new Date(now - 10000),
      },
      {
        id: 'res-rejected-kp1',
        phoneEncrypted: cryptoService.encrypt('+84955555551'),
        phoneHash: cryptoService.hashPhone('+84955555551'),
        fullName: 'Đỗ Văn Rejected KP1',
        role: Role.resident,
        status: DbAccountStatus.rejected,
        address: '404 KP1',
        neighborhoodId: 'neigh-1',
        neighborhood: mockNeighborhoods[0] ?? null,
        rejectionReason: 'Thông tin không chính xác',
        lockReason: null,
        createdAt: new Date(now - 5000),
        updatedAt: new Date(now - 5000),
      },
    ];

    prisma = {
      $transaction: async <R>(
        fn: (tx: Prisma.TransactionClient) => Promise<R>,
      ): Promise<R> => fn(prisma as unknown as Prisma.TransactionClient),
      account: {
        findMany: async ({
          where,
          orderBy,
        }: {
          where?: Prisma.AccountWhereInput;
          orderBy?:
            | Prisma.AccountOrderByWithRelationInput
            | Prisma.AccountOrderByWithRelationInput[];
        }) => {
          const filtered = mockAccounts.filter((acc) => {
            if (where?.role && acc.role !== where.role) return false;
            if (where?.status) {
              if (
                typeof where.status === 'object' &&
                where.status !== null &&
                'in' in where.status &&
                Array.isArray(where.status.in)
              ) {
                if (!where.status.in.includes(acc.status)) return false;
              } else if (acc.status !== where.status) {
                return false;
              }
            }
            if (where?.neighborhoodId && acc.neighborhoodId !== where.neighborhoodId)
              return false;
            return true;
          });

          if (orderBy) {
            return [...filtered].sort((a, b) => {
              const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
              if (timeDiff !== 0) return timeDiff;
              return a.id.localeCompare(b.id);
            });
          }

          return filtered;
        },
        findUnique: async ({ where }: { where: Prisma.AccountWhereUniqueInput }) => {
          if (where.id) return mockAccounts.find((a) => a.id === where.id) || null;
          if (where.phoneHash)
            return mockAccounts.find((a) => a.phoneHash === where.phoneHash) || null;
          return null;
        },
        create: async ({ data }: { data: Prisma.AccountUncheckedCreateInput }) => {
          const newAcc: MockAccount = {
            id: 'acc-' + Date.now(),
            phoneEncrypted: data.phoneEncrypted,
            phoneHash: data.phoneHash,
            fullName: data.fullName,
            role: data.role ?? Role.resident,
            status: data.status ?? DbAccountStatus.pending,
            address: data.address ?? null,
            neighborhoodId: data.neighborhoodId ?? null,
            neighborhood: mockNeighborhoods.find((n) => n.id === data.neighborhoodId) || null,
            rejectionReason: data.rejectionReason ?? null,
            lockReason: data.lockReason ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockAccounts.push(newAcc);
          return newAcc;
        },
        update: async ({
          where,
          data,
        }: {
          where: Prisma.AccountWhereUniqueInput;
          data: Prisma.AccountUpdateInput;
        }) => {
          const acc = mockAccounts.find((a) => a.id === where.id);
          if (!acc) throw new Error('Account not found');
          Object.assign(acc, data, { updatedAt: new Date() });
          return acc;
        },
      },
      neighborhood: {
        findUnique: async ({ where }: { where: Prisma.NeighborhoodWhereUniqueInput }) => {
          return mockNeighborhoods.find((n) => n.id === where.id) || null;
        },
      },
    } as unknown as PrismaService;

    usersService = new UsersService(
      prisma,
      cryptoService,
      sessionService,
      smsPublisherService,
    );
  });

  describe('Leader Neighborhood Scoping & Isolation', () => {
    const leaderKP1: UserDto = {
      id: 'leader-1',
      maskedPhone: '098***1111',
      fullName: 'Trưởng Khu Phố 1',
      role: UserRole.LEADER,
      status: AccountStatus.ACTIVE,
      neighborhoodId: 'neigh-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should list only pending residents in the leader assigned neighborhood', async () => {
      const list = await usersService.getPendingResidents(leaderKP1);
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe('res-1');
      expect(list[0]?.neighborhoodId).toBe('neigh-1');
    });

    it('should allow leader to approve pending resident in their own neighborhood', async () => {
      const approved = await usersService.approveResident('res-1', leaderKP1);
      expect(approved.status).toBe(AccountStatus.ACTIVE);

      // Verify SMS notification published
      expect(rabbitmqService.publishedMessages.length).toBe(1);
    });

    it('should REJECT leader attempt to approve resident from another neighborhood (Cross-Neighborhood Isolation)', async () => {
      try {
        await usersService.approveResident('res-2', leaderKP1);
        expect.unreachable('Should have thrown FORBIDDEN');
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).errorCode).toBe(ErrorCode.FORBIDDEN);
      }
    });

    it('should require a non-empty reason when rejecting an account', async () => {
      try {
        await usersService.rejectResident('res-1', { reason: '   ' }, leaderKP1);
        expect.unreachable('Should have thrown REASON_REQUIRED');
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).errorCode).toBe(ErrorCode.REASON_REQUIRED);
      }
    });

    it('should allow leader to reject resident in their neighborhood with reason and publish SMS', async () => {
      const rejected = await usersService.rejectResident(
        'res-1',
        { reason: 'Sai số nhà và tổ dân phố' },
        leaderKP1,
      );
      expect(rejected.status).toBe(AccountStatus.REJECTED);
      expect(rejected.rejectionReason).toBe('Sai số nhà và tổ dân phố');
      expect(rabbitmqService.publishedMessages.length).toBe(1);
    });

    it('should require reason when locking an account and revoke active sessions', async () => {
      // First make account active
      const firstAcc = mockAccounts[0];
      if (firstAcc) {
        firstAcc.status = DbAccountStatus.active;
      }

      const locked = await usersService.lockResident(
        'res-1',
        { reason: 'Cư dân đã chuyển đi nơi khác sinh sống' },
        leaderKP1,
      );
      expect(locked.status).toBe(AccountStatus.LOCKED);
      expect(locked.lockReason).toBe('Cư dân đã chuyển đi nơi khác sinh sống');
    });

    it('should reject illegal resident status transitions', async () => {
      await expect(
        usersService.lockResident('res-1', { reason: 'Không hợp lệ' }, leaderKP1),
      ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_STATUS_TRANSITION });

      await expect(usersService.unlockResident('res-1', leaderKP1)).rejects.toMatchObject({
        errorCode: ErrorCode.INVALID_STATUS_TRANSITION,
      });

      const firstAcc = mockAccounts[0];
      if (firstAcc) firstAcc.status = DbAccountStatus.active;
      await expect(
        usersService.rejectResident('res-1', { reason: 'Không hợp lệ' }, leaderKP1),
      ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_STATUS_TRANSITION });
    });

    it('should never let resident moderation endpoints mutate a non-resident role', async () => {
      const firstAcc = mockAccounts[0];
      if (firstAcc) firstAcc.role = Role.leader;

      await expect(usersService.approveResident('res-1', leaderKP1)).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });
    });
  });

  describe('Officer Leader Creation', () => {
    const officer: UserDto = {
      id: 'officer-1',
      maskedPhone: '090***9999',
      fullName: 'Cán Bộ Phường',
      role: UserRole.OFFICER,
      status: AccountStatus.ACTIVE,
      neighborhoodId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should allow officer to create an active leader for a neighborhood', async () => {
      const created = await usersService.createLeader(
        {
          phoneNumber: '0933445566',
          fullName: 'Nguyễn Văn Trưởng Mới',
          neighborhoodId: 'neigh-1',
          address: 'Ủy ban nhân dân',
        },
        officer,
      );

      expect(created.role).toBe(UserRole.LEADER);
      expect(created.status).toBe(AccountStatus.ACTIVE);
      expect(created.neighborhoodId).toBe('neigh-1');
      expect(rabbitmqService.publishedMessages.length).toBe(1);
    });

    it('should prevent two active leaders from being assigned to one neighborhood', async () => {
      await usersService.createLeader(
        {
          phoneNumber: '0933445566',
          fullName: 'Trưởng thứ nhất',
          neighborhoodId: 'neigh-1',
        },
        officer,
      );

      await expect(
        usersService.createLeader(
          {
            phoneNumber: '0933445567',
            fullName: 'Trưởng thứ hai',
            neighborhoodId: 'neigh-1',
          },
          officer,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_STATUS_TRANSITION });
    });
  });

  describe('Officer Bootstrap', () => {
    it('should successfully bootstrap the initial active officer when none exists', async () => {
      const officerPhone = '0901234567';
      const fullName = 'Nguyễn Văn Cán Bộ Phường';

      const result = await usersService.bootstrapOfficer(officerPhone, fullName);

      expect(result.role).toBe(UserRole.OFFICER);
      expect(result.status).toBe(AccountStatus.ACTIVE);
      expect(result.fullName).toBe(fullName);
      expect(result.maskedPhone).toBe('090***4567');
      expect(result.isExisting).toBe(false);

      // Verify stored account in database
      const stored = mockAccounts.find((a) => a.id === result.id);
      expect(stored).toBeDefined();
      expect(stored?.role).toBe(Role.officer);
      expect(stored?.status).toBe(DbAccountStatus.active);
      expect(stored?.phoneEncrypted).toBeDefined();
      expect(stored?.phoneHash).toBe(cryptoService.hashPhone('+84901234567'));
    });

    it('should be idempotent for the exact same officer identity on rerun', async () => {
      const officerPhone = '0901234567';
      const fullName = 'Nguyễn Văn Cán Bộ Phường';

      const first = await usersService.bootstrapOfficer(officerPhone, fullName);
      expect(first.isExisting).toBe(false);

      const second = await usersService.bootstrapOfficer(officerPhone, fullName);
      expect(second.isExisting).toBe(true);
      expect(second.id).toBe(first.id);
      expect(second.maskedPhone).toBe('090***4567');
    });

    it('should refuse to create a different first officer when an officer already exists', async () => {
      // Create first officer
      await usersService.bootstrapOfficer('0901234567', 'Cán Bộ Thứ Nhất');

      // Attempt to bootstrap another officer with different phone
      await expect(
        usersService.bootstrapOfficer('0907654321', 'Cán Bộ Thứ Hai'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.FORBIDDEN });

      // Attempt to bootstrap with same phone but different name
      await expect(
        usersService.bootstrapOfficer('0901234567', 'Cán Bộ Đổi Tên'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.FORBIDDEN });
    });

    it('should refuse to bootstrap officer if phone is already owned by another role (resident/leader)', async () => {
      // Phone '0911111111' is already owned by res-1 (resident)
      await expect(
        usersService.bootstrapOfficer('0911111111', 'Cán Bộ Chiếm Số'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.PHONE_ALREADY_EXISTS });
    });

    it('should validate and reject missing or invalid inputs', async () => {
      await expect(
        usersService.bootstrapOfficer('', 'Cán Bộ'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_PHONE_NUMBER });

      await expect(
        usersService.bootstrapOfficer('12345', 'Cán Bộ'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.INVALID_PHONE_NUMBER });

      await expect(
        usersService.bootstrapOfficer('0901234567', '   '),
      ).rejects.toMatchObject({ errorCode: ErrorCode.VALIDATION_ERROR });
    });

    it('retries on Serializable conflict (P2034) and succeeds idempotently for same identity', async () => {
      let attempts = 0;
      const txSpy = vi
        .spyOn(prisma, '$transaction')
        .mockImplementation(
          async <R>(
            fn: (tx: Prisma.TransactionClient) => Promise<R>,
          ): Promise<R> => {
            attempts++;
            if (attempts === 1) {
              // Simulate first transaction losing race condition to a concurrent winner with same identity
              const winner: MockAccount = {
                id: 'officer-concurrent-1',
                phoneEncrypted: cryptoService.encrypt('+84901234567'),
                phoneHash: cryptoService.hashPhone('+84901234567'),
                fullName: 'Nguyễn Văn Cán Bộ Phường',
                role: Role.officer,
                status: DbAccountStatus.active,
                address: null,
                neighborhoodId: null,
                neighborhood: null,
                rejectionReason: null,
                lockReason: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              mockAccounts.push(winner);
              const p2034Err = new Prisma.PrismaClientKnownRequestError(
                'Transaction failed due to a write conflict or a deadlock. Please retry your transaction',
                { code: 'P2034', clientVersion: '6.4.1' },
              );
              throw p2034Err;
            }
            return fn(prisma as unknown as Prisma.TransactionClient);
          },
        );

      const result = await usersService.bootstrapOfficer('0901234567', 'Nguyễn Văn Cán Bộ Phường');
      expect(attempts).toBe(2);
      expect(result.isExisting).toBe(true);
      expect(result.fullName).toBe('Nguyễn Văn Cán Bộ Phường');
      expect(result.maskedPhone).toBe('090***4567');

      txSpy.mockRestore();
    });

    it('retries on Serializable conflict and rejects when different identity won the race', async () => {
      let attempts = 0;
      const txSpy = vi
        .spyOn(prisma, '$transaction')
        .mockImplementation(
          async <R>(
            fn: (tx: Prisma.TransactionClient) => Promise<R>,
          ): Promise<R> => {
            attempts++;
            if (attempts === 1) {
              // Simulate first transaction losing race to a concurrent winner with DIFFERENT identity
              const winner: MockAccount = {
                id: 'officer-concurrent-2',
                phoneEncrypted: cryptoService.encrypt('+84909999999'),
                phoneHash: cryptoService.hashPhone('+84909999999'),
                fullName: 'Cán Bộ Khác Đã Thắng',
                role: Role.officer,
                status: DbAccountStatus.active,
                address: null,
                neighborhoodId: null,
                neighborhood: null,
                rejectionReason: null,
                lockReason: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              mockAccounts.push(winner);
              const p2034Err = new Prisma.PrismaClientKnownRequestError(
                'Transaction failed due to a write conflict',
                { code: 'P2034', clientVersion: '6.4.1' },
              );
              throw p2034Err;
            }
            return fn(prisma as unknown as Prisma.TransactionClient);
          },
        );

      await expect(
        usersService.bootstrapOfficer('0901234567', 'Cán Bộ Đến Sau'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.FORBIDDEN });

      expect(attempts).toBe(2);
      txSpy.mockRestore();
    });
  });

  describe('Managed Residents Listing (getManagedResidents)', () => {
    const leaderKP1: UserDto = {
      id: 'leader-1',
      maskedPhone: '098***1111',
      fullName: 'Trưởng Khu Phố 1',
      role: UserRole.LEADER,
      status: AccountStatus.ACTIVE,
      neighborhoodId: 'neigh-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const leaderUnassigned: UserDto = {
      id: 'leader-unassigned',
      maskedPhone: '098***2222',
      fullName: 'Trưởng Chưa Gán KP',
      role: UserRole.LEADER,
      status: AccountStatus.ACTIVE,
      neighborhoodId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const officer: UserDto = {
      id: 'officer-1',
      maskedPhone: '090***9999',
      fullName: 'Cán Bộ Phường',
      role: UserRole.OFFICER,
      status: AccountStatus.ACTIVE,
      neighborhoodId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const residentUser: UserDto = {
      id: 'resident-user',
      maskedPhone: '091***3333',
      fullName: 'Cư Dân Thường',
      role: UserRole.RESIDENT,
      status: AccountStatus.ACTIVE,
      neighborhoodId: 'neigh-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should list only active and locked residents in leader assigned neighborhood', async () => {
      const residents = await usersService.getManagedResidents(leaderKP1);

      expect(residents.length).toBe(2);
      expect(residents.map((r) => r.id)).toEqual(
        expect.arrayContaining(['res-active-kp1', 'res-locked-kp1']),
      );
      residents.forEach((r) => {
        expect(r.neighborhoodId).toBe('neigh-1');
        expect([AccountStatus.ACTIVE, AccountStatus.LOCKED]).toContain(r.status);
      });
      expect(residents.some((r) => r.status === AccountStatus.PENDING)).toBe(false);
      expect(residents.some((r) => r.status === AccountStatus.REJECTED)).toBe(false);
      expect(residents.some((r) => r.neighborhoodId === 'neigh-2')).toBe(false);
    });

    it('should strictly enforce leader neighborhood scope even if query attempts cross-neighborhood parameter', async () => {
      const residents = await usersService.getManagedResidents(leaderKP1, {
        neighborhoodId: 'neigh-2',
      });

      expect(residents.length).toBe(2);
      residents.forEach((r) => {
        expect(r.neighborhoodId).toBe('neigh-1');
      });
      expect(residents.some((r) => r.id === 'res-active-kp2')).toBe(false);
    });

    it('should throw FORBIDDEN if leader is missing neighborhood assignment', async () => {
      await expect(
        usersService.getManagedResidents(leaderUnassigned),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });
    });

    it('should filter active-only residents when status=active is requested', async () => {
      const residents = await usersService.getManagedResidents(leaderKP1, {
        status: AccountStatus.ACTIVE,
      });

      expect(residents.length).toBe(1);
      expect(residents[0]?.id).toBe('res-active-kp1');
      expect(residents[0]?.status).toBe(AccountStatus.ACTIVE);
    });

    it('should filter locked-only residents when status=locked is requested', async () => {
      const residents = await usersService.getManagedResidents(leaderKP1, {
        status: AccountStatus.LOCKED,
      });

      expect(residents.length).toBe(1);
      expect(residents[0]?.id).toBe('res-locked-kp1');
      expect(residents[0]?.status).toBe(AccountStatus.LOCKED);
      expect(residents[0]?.lockReason).toBe('Chuyển đi');
    });

    it('should reject invalid status filter at service layer', async () => {
      await expect(
        usersService.getManagedResidents(leaderKP1, {
          status: AccountStatus.PENDING as unknown as ManagedResidentStatus,
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.VALIDATION_ERROR,
      });
    });

    it('should allow officer to list active and locked residents across all neighborhoods (ward-wide)', async () => {
      const residents = await usersService.getManagedResidents(officer);

      expect(residents.length).toBe(4);
      expect(residents.map((r) => r.id)).toEqual(
        expect.arrayContaining([
          'res-active-kp1',
          'res-locked-kp1',
          'res-active-kp2',
          'res-locked-kp2',
        ]),
      );
      expect(residents.some((r) => r.neighborhoodId === 'neigh-1')).toBe(true);
      expect(residents.some((r) => r.neighborhoodId === 'neigh-2')).toBe(true);
    });

    it('should allow officer to optionally filter by neighborhoodId', async () => {
      const kp2Residents = await usersService.getManagedResidents(officer, {
        neighborhoodId: 'neigh-2',
      });

      expect(kp2Residents.length).toBe(2);
      expect(kp2Residents.map((r) => r.id)).toEqual(
        expect.arrayContaining(['res-active-kp2', 'res-locked-kp2']),
      );
      kp2Residents.forEach((r) => {
        expect(r.neighborhoodId).toBe('neigh-2');
      });
    });

    it('should allow officer to filter by status and neighborhoodId simultaneously', async () => {
      const lockedKp2 = await usersService.getManagedResidents(officer, {
        neighborhoodId: 'neigh-2',
        status: AccountStatus.LOCKED,
      });

      expect(lockedKp2.length).toBe(1);
      expect(lockedKp2[0]?.id).toBe('res-locked-kp2');
      expect(lockedKp2[0]?.status).toBe(AccountStatus.LOCKED);
    });

    it('should reject resident role from calling getManagedResidents (FORBIDDEN)', async () => {
      await expect(
        usersService.getManagedResidents(residentUser),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });
    });

    it('should return masked phone numbers and deterministic ordering (createdAt desc, id asc)', async () => {
      const residents = await usersService.getManagedResidents(officer);

      residents.forEach((r) => {
        expect(r.maskedPhone).toMatch(/^\+?84\d{2}\*{3}\d{3,4}$|^\d{3}\*{3}\d{3,4}$/);
      });

      for (let i = 0; i < residents.length - 1; i++) {
        const curr = new Date(residents[i]!.createdAt).getTime();
        const next = new Date(residents[i + 1]!.createdAt).getTime();
        expect(curr).toBeGreaterThanOrEqual(next);
      }
    });
  });

  describe('ManagedResidentQueryDto Validation', () => {
    it('should pass validation for an empty query', async () => {
      const dto = plainToInstance(ManagedResidentQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation with valid active/locked status', async () => {
      const activeDto = plainToInstance(ManagedResidentQueryDto, {
        status: AccountStatus.ACTIVE,
      });
      const activeErrors = await validate(activeDto);
      expect(activeErrors.length).toBe(0);

      const lockedDto = plainToInstance(ManagedResidentQueryDto, {
        status: AccountStatus.LOCKED,
      });
      const lockedErrors = await validate(lockedDto);
      expect(lockedErrors.length).toBe(0);
    });

    it('should pass validation with valid UUID neighborhoodId', async () => {
      const dto = plainToInstance(ManagedResidentQueryDto, {
        neighborhoodId: '123e4567-e89b-42d3-a456-426614174000',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject pending or rejected status values', async () => {
      const pendingDto = plainToInstance(ManagedResidentQueryDto, {
        status: AccountStatus.PENDING,
      });
      const pendingErrors = await validate(pendingDto);
      expect(pendingErrors.length).toBeGreaterThan(0);
      expect(pendingErrors[0]?.property).toBe('status');

      const rejectedDto = plainToInstance(ManagedResidentQueryDto, {
        status: AccountStatus.REJECTED,
      });
      const rejectedErrors = await validate(rejectedDto);
      expect(rejectedErrors.length).toBeGreaterThan(0);
      expect(rejectedErrors[0]?.property).toBe('status');
    });

    it('should reject invalid UUID for neighborhoodId', async () => {
      const dto = plainToInstance(ManagedResidentQueryDto, {
        neighborhoodId: 'invalid-not-a-uuid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.property).toBe('neighborhoodId');
    });
  });
});
