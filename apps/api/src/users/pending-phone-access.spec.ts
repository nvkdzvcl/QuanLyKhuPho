import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  Account,
  Neighborhood,
  Prisma,
  Role,
  AccountStatus as DbAccountStatus,
} from '@prisma/client';
import {
  AccountStatus,
  ErrorCode,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { SmsPublisherService } from '../rabbitmq/sms-publisher.service';
import { CryptoService } from '../security/crypto.service';
import { SessionService } from '../auth/session.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthGuard } from '../security/guards/auth.guard';
import { RolesGuard } from '../security/guards/roles.guard';
import { CsrfGuard } from '../security/guards/csrf.guard';
import { ROLES_KEY } from '../security/decorators/roles.decorator';

type MockAccount = Account & {
  neighborhood: Neighborhood | null;
};

interface MockPhoneAccessLog {
  id: string;
  actorAccountId: string;
  targetAccountId: string;
  neighborhoodId: string | null;
  actorRole: Role;
  createdAt: Date;
}

describe('Pending Resident Phone Access & Audit Spec', () => {
  let usersService: UsersService;
  let prisma: PrismaService;
  let cryptoService: CryptoService;
  let sessionService: SessionService;
  let smsPublisherService: SmsPublisherService;
  let rabbitmqService: RabbitMQService;
  let redisService: RedisService;

  let mockAccounts: MockAccount[] = [];
  let mockNeighborhoods: Neighborhood[] = [];
  let mockAccessLogs: MockPhoneAccessLog[] = [];

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
    maskedPhone: '098***3333',
    fullName: 'Trưởng Chưa Phân Công',
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
    maskedPhone: '091***4444',
    fullName: 'Cư Dân Thường',
    role: UserRole.RESIDENT,
    status: AccountStatus.ACTIVE,
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockAccessLogs = [];
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

    smsPublisherService = new SmsPublisherService(
      rabbitmqService,
      cryptoService,
    );

    const now = Date.now();
    mockAccounts = [
      {
        id: 'res-pending-kp1',
        phoneEncrypted: cryptoService.encrypt('+84911111111'),
        phoneHash: cryptoService.hashPhone('+84911111111'),
        fullName: 'Nguyễn Văn Chờ Duyệt KP1',
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
        id: 'res-pending-kp2',
        phoneEncrypted: cryptoService.encrypt('+84922222222'),
        phoneHash: cryptoService.hashPhone('+84922222222'),
        fullName: 'Trần Thị Chờ Duyệt KP2',
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
        id: 'res-active-kp2',
        phoneEncrypted: cryptoService.encrypt('+84922222223'),
        phoneHash: cryptoService.hashPhone('+84922222223'),
        fullName: 'Trần Văn Hoạt Động KP2',
        role: Role.resident,
        status: DbAccountStatus.active,
        address: '457 KP2',
        neighborhoodId: 'neigh-2',
        neighborhood: mockNeighborhoods[1] ?? null,
        rejectionReason: null,
        lockReason: null,
        createdAt: new Date(now - 45000),
        updatedAt: new Date(now - 45000),
      },
      {
        id: 'res-locked-kp2',
        phoneEncrypted: cryptoService.encrypt('+84922222224'),
        phoneHash: cryptoService.hashPhone('+84922222224'),
        fullName: 'Trần Thị Khóa KP2',
        role: Role.resident,
        status: DbAccountStatus.locked,
        address: '458 KP2',
        neighborhoodId: 'neigh-2',
        neighborhood: mockNeighborhoods[1] ?? null,
        rejectionReason: null,
        lockReason: 'Khóa mẫu',
        createdAt: new Date(now - 42000),
        updatedAt: new Date(now - 42000),
      },
      {
        id: 'res-active-kp1',
        phoneEncrypted: cryptoService.encrypt('+84933333331'),
        phoneHash: cryptoService.hashPhone('+84933333331'),
        fullName: 'Lê Văn Đã Hoạt Động KP1',
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
        fullName: 'Phạm Thị Đã Khóa KP1',
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
        id: 'res-rejected-kp1',
        phoneEncrypted: cryptoService.encrypt('+84933333333'),
        phoneHash: cryptoService.hashPhone('+84933333333'),
        fullName: 'Vũ Thị Từ Chối KP1',
        role: Role.resident,
        status: DbAccountStatus.rejected,
        address: '102 KP1',
        neighborhoodId: 'neigh-1',
        neighborhood: mockNeighborhoods[0] ?? null,
        rejectionReason: 'Hồ sơ không hợp lệ',
        lockReason: null,
        createdAt: new Date(now - 25000),
        updatedAt: new Date(now - 25000),
      },
      {
        id: 'leader-account-kp1',
        phoneEncrypted: cryptoService.encrypt('+84988888888'),
        phoneHash: cryptoService.hashPhone('+84988888888'),
        fullName: 'Trưởng Khu Phố Account',
        role: Role.leader,
        status: DbAccountStatus.active,
        address: '100 KP1',
        neighborhoodId: 'neigh-1',
        neighborhood: mockNeighborhoods[0] ?? null,
        rejectionReason: null,
        lockReason: null,
        createdAt: new Date(now - 20000),
        updatedAt: new Date(now - 20000),
      },
    ];

    prisma = {
      $transaction: async <R>(
        fn: (tx: Prisma.TransactionClient) => Promise<R>,
      ): Promise<R> => fn(prisma as unknown as Prisma.TransactionClient),
      account: {
        findUnique: async ({
          where,
        }: {
          where: Prisma.AccountWhereUniqueInput;
        }) => {
          if (where.id)
            return mockAccounts.find((a) => a.id === where.id) || null;
          if (where.phoneHash)
            return (
              mockAccounts.find((a) => a.phoneHash === where.phoneHash) || null
            );
          return null;
        },
      },
      accountPhoneAccessLog: {
        create: async ({
          data,
        }: {
          data: {
            actorAccountId: string;
            targetAccountId: string;
            neighborhoodId: string | null;
            actorRole: Role;
          };
        }) => {
          const log: MockPhoneAccessLog = {
            id: 'log-' + Date.now() + '-' + Math.random(),
            actorAccountId: data.actorAccountId,
            targetAccountId: data.targetAccountId,
            neighborhoodId: data.neighborhoodId,
            actorRole: data.actorRole,
            createdAt: new Date(),
          };
          mockAccessLogs.push(log);
          return log;
        },
      },
      neighborhood: {
        findUnique: async ({
          where,
        }: {
          where: Prisma.NeighborhoodWhereUniqueInput;
        }) => {
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

  describe('UsersController Contract & Metadata', () => {
    it('should have AuthGuard, RolesGuard, and CsrfGuard applied at Controller class level', () => {
      const guards = Reflect.getMetadata('__guards__', UsersController);
      expect(guards).toBeDefined();
      expect(guards).toEqual([AuthGuard, RolesGuard, CsrfGuard]);
    });

    it('should restrict revealResidentPhone to LEADER and OFFICER roles', () => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        UsersController.prototype.revealResidentPhone,
      );
      expect(roles).toBeDefined();
      expect(roles).toEqual([UserRole.LEADER, UserRole.OFFICER]);
    });

    it('should configure Cache-Control no-store, private and Pragma no-cache response headers', () => {
      const headers = Reflect.getMetadata(
        '__headers__',
        UsersController.prototype.revealResidentPhone,
      );
      expect(headers).toBeDefined();
      expect(headers).toEqual(
        expect.arrayContaining([
          { name: 'Cache-Control', value: 'no-store, private' },
          { name: 'Pragma', value: 'no-cache' },
        ]),
      );
    });

    it('delegates revealResidentPhone from controller to usersService', async () => {
      const mockUsersService = {
        revealResidentPhone: vi
          .fn()
          .mockResolvedValue({ phoneNumber: '+84911111111' }),
      };
      const controller = new UsersController(
        mockUsersService as unknown as UsersService,
      );

      const result = await controller.revealResidentPhone(
        'res-pending-kp1',
        leaderKP1,
      );

      expect(
        mockUsersService.revealResidentPhone,
      ).toHaveBeenCalledWith('res-pending-kp1', leaderKP1);
      expect(result).toEqual({ phoneNumber: '+84911111111' });
    });
  });

  describe('Permitted Phone Access & Persistent Audit Log', () => {
    it('allows assigned leader to reveal pending resident phone and logs persistent audit record', async () => {
      const result = await usersService.revealResidentPhone(
        'res-pending-kp1',
        leaderKP1,
      );

      expect(result).toEqual({ phoneNumber: '+84911111111' });
      expect(mockAccessLogs.length).toBe(1);

      const log = mockAccessLogs[0];
      expect(log).toBeDefined();
      expect(log?.actorAccountId).toBe('leader-1');
      expect(log?.targetAccountId).toBe('res-pending-kp1');
      expect(log?.neighborhoodId).toBe('neigh-1');
      expect(log?.actorRole).toBe(Role.leader);
      expect(log?.createdAt).toBeInstanceOf(Date);
    });

    it('allows assigned leader to reveal active resident phone and logs persistent audit record', async () => {
      const result = await usersService.revealResidentPhone(
        'res-active-kp1',
        leaderKP1,
      );

      expect(result).toEqual({ phoneNumber: '+84933333331' });
      expect(mockAccessLogs.length).toBe(1);

      const log = mockAccessLogs[0];
      expect(log).toBeDefined();
      expect(log?.actorAccountId).toBe('leader-1');
      expect(log?.targetAccountId).toBe('res-active-kp1');
      expect(log?.neighborhoodId).toBe('neigh-1');
      expect(log?.actorRole).toBe(Role.leader);
      expect(log?.createdAt).toBeInstanceOf(Date);
    });

    it('allows assigned leader to reveal locked resident phone and logs persistent audit record', async () => {
      const result = await usersService.revealResidentPhone(
        'res-locked-kp1',
        leaderKP1,
      );

      expect(result).toEqual({ phoneNumber: '+84933333332' });
      expect(mockAccessLogs.length).toBe(1);

      const log = mockAccessLogs[0];
      expect(log).toBeDefined();
      expect(log?.actorAccountId).toBe('leader-1');
      expect(log?.targetAccountId).toBe('res-locked-kp1');
      expect(log?.neighborhoodId).toBe('neigh-1');
      expect(log?.actorRole).toBe(Role.leader);
      expect(log?.createdAt).toBeInstanceOf(Date);
    });

    it('allows officer to reveal pending resident phone across any neighborhood and logs audit record', async () => {
      const result = await usersService.revealResidentPhone(
        'res-pending-kp2',
        officer,
      );

      expect(result).toEqual({ phoneNumber: '+84922222222' });
      expect(mockAccessLogs.length).toBe(1);

      const log = mockAccessLogs[0];
      expect(log).toBeDefined();
      expect(log?.actorAccountId).toBe('officer-1');
      expect(log?.targetAccountId).toBe('res-pending-kp2');
      expect(log?.neighborhoodId).toBe('neigh-2');
      expect(log?.actorRole).toBe(Role.officer);
    });

    it('allows officer to reveal active resident phone across any neighborhood and logs audit record', async () => {
      const result = await usersService.revealResidentPhone(
        'res-active-kp1',
        officer,
      );

      expect(result).toEqual({ phoneNumber: '+84933333331' });
      expect(mockAccessLogs.length).toBe(1);

      const log = mockAccessLogs[0];
      expect(log).toBeDefined();
      expect(log?.actorAccountId).toBe('officer-1');
      expect(log?.targetAccountId).toBe('res-active-kp1');
      expect(log?.neighborhoodId).toBe('neigh-1');
      expect(log?.actorRole).toBe(Role.officer);
    });

    it('allows officer to reveal locked resident phone across any neighborhood and logs audit record', async () => {
      const result = await usersService.revealResidentPhone(
        'res-locked-kp1',
        officer,
      );

      expect(result).toEqual({ phoneNumber: '+84933333332' });
      expect(mockAccessLogs.length).toBe(1);

      const log = mockAccessLogs[0];
      expect(log).toBeDefined();
      expect(log?.actorAccountId).toBe('officer-1');
      expect(log?.targetAccountId).toBe('res-locked-kp1');
      expect(log?.neighborhoodId).toBe('neigh-1');
      expect(log?.actorRole).toBe(Role.officer);
    });

    it('ensures audit log stores only permitted metadata and strictly NO phone, name, address, or IP', async () => {
      await usersService.revealResidentPhone(
        'res-pending-kp1',
        leaderKP1,
      );

      const log = mockAccessLogs[0];
      expect(log).toBeDefined();
      const keys = Object.keys(log!);

      expect(keys).toEqual(
        expect.arrayContaining([
          'id',
          'actorAccountId',
          'targetAccountId',
          'neighborhoodId',
          'actorRole',
          'createdAt',
        ]),
      );

      expect(keys).not.toContain('phoneNumber');
      expect(keys).not.toContain('phone');
      expect(keys).not.toContain('phoneEncrypted');
      expect(keys).not.toContain('phoneHash');
      expect(keys).not.toContain('fullName');
      expect(keys).not.toContain('name');
      expect(keys).not.toContain('address');
      expect(keys).not.toContain('ip');
      expect(keys).not.toContain('ipAddress');
    });
  });

  describe('Authorization, Scoping & Validation Denials', () => {
    it('denies resident role from revealing resident phone (FORBIDDEN)', async () => {
      await expect(
        usersService.revealResidentPhone(
          'res-pending-kp1',
          residentUser,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });

      expect(mockAccessLogs.length).toBe(0);
    });

    it('denies inactive currentUser (e.g. locked or pending leader)', async () => {
      const inactiveLeader: UserDto = {
        ...leaderKP1,
        status: AccountStatus.LOCKED,
      };

      await expect(
        usersService.revealResidentPhone(
          'res-pending-kp1',
          inactiveLeader,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });

      expect(mockAccessLogs.length).toBe(0);
    });

    it('denies leader without neighborhood assignment (FORBIDDEN)', async () => {
      await expect(
        usersService.revealResidentPhone(
          'res-pending-kp1',
          leaderUnassigned,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });

      expect(mockAccessLogs.length).toBe(0);
    });

    it('denies cross-neighborhood pending resident access by leader (Isolation invariant)', async () => {
      await expect(
        usersService.revealResidentPhone(
          'res-pending-kp2',
          leaderKP1,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });

      expect(mockAccessLogs.length).toBe(0);
    });

    it('denies cross-neighborhood active resident access by leader (Isolation invariant)', async () => {
      await expect(
        usersService.revealResidentPhone(
          'res-active-kp2',
          leaderKP1,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });

      expect(mockAccessLogs.length).toBe(0);
    });

    it('denies cross-neighborhood locked resident access by leader (Isolation invariant)', async () => {
      await expect(
        usersService.revealResidentPhone(
          'res-locked-kp2',
          leaderKP1,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });

      expect(mockAccessLogs.length).toBe(0);
    });

    it('denies revealing phone for rejected resident (rejected target)', async () => {
      await expect(
        usersService.revealResidentPhone(
          'res-rejected-kp1',
          leaderKP1,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.INVALID_STATUS_TRANSITION,
      });

      expect(mockAccessLogs.length).toBe(0);
    });

    it('denies revealing phone for non-resident target (e.g. leader account)', async () => {
      await expect(
        usersService.revealResidentPhone(
          'leader-account-kp1',
          leaderKP1,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.FORBIDDEN,
      });

      expect(mockAccessLogs.length).toBe(0);
    });

    it('denies access when target account does not exist (ACCOUNT_NOT_FOUND)', async () => {
      await expect(
        usersService.revealResidentPhone(
          'non-existent-id',
          leaderKP1,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.ACCOUNT_NOT_FOUND,
      });

      expect(mockAccessLogs.length).toBe(0);
    });
  });

  describe('Fail-Closed Integrity (Decryption & Audit Failures)', () => {
    it('fails closed when decryption fails without revealing corrupted phone', async () => {
      const target = mockAccounts.find((a) => a.id === 'res-pending-kp1');
      if (target) {
        target.phoneEncrypted = 'corrupted-ciphertext';
      }

      await expect(
        usersService.revealResidentPhone(
          'res-pending-kp1',
          leaderKP1,
        ),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.INTERNAL_ERROR,
      });

      expect(mockAccessLogs.length).toBe(0);
    });

    it('fails closed when audit log insertion fails in transaction', async () => {
      prisma.accountPhoneAccessLog.create = vi
        .fn()
        .mockRejectedValue(new Error('DB Audit Log constraint violation'));

      await expect(
        usersService.revealResidentPhone(
          'res-pending-kp1',
          leaderKP1,
        ),
      ).rejects.toThrow('DB Audit Log constraint violation');
    });
  });
});
