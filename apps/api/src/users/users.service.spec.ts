import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Account, Neighborhood, Prisma, Role, AccountStatus as DbAccountStatus } from '@prisma/client';
import { AccountStatus, ErrorCode, UserDto, UserRole } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { SmsPublisherService } from '../rabbitmq/sms-publisher.service';
import { CryptoService } from '../security/crypto.service';
import { SessionService } from '../auth/session.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from './users.service';

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
        createdAt: new Date(),
        updatedAt: new Date(),
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prisma = {
      account: {
        findMany: async ({ where }: { where?: Prisma.AccountWhereInput }) => {
          return mockAccounts.filter((acc) => {
            if (where?.role && acc.role !== where.role) return false;
            if (where?.status && acc.status !== where.status) return false;
            if (where?.neighborhoodId && acc.neighborhoodId !== where.neighborhoodId)
              return false;
            return true;
          });
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
});
