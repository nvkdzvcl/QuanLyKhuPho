import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { NotificationsService } from './notifications.service';
import { NotificationType } from '@quanlykhupho/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import { OperationalMetricsService } from '../observability/operational-metrics.service';

vi.mock('web-push', () => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

interface MockPrisma {
  notification: {
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  pushSubscription: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaMock: MockPrisma;
  let cryptoServiceMock: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  let metricsServiceMock: {
    recordPushAttempt: ReturnType<typeof vi.fn>;
    recordPushSuccess: ReturnType<typeof vi.fn>;
    recordPushFailure: ReturnType<typeof vi.fn>;
    recordPushStalePruned: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock = {
      notification: {
        create: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      pushSubscription: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const configServiceMock = {
      get: vi.fn((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') return 'test-public-key';
        if (key === 'VAPID_PRIVATE_KEY') return 'test-private-key';
        if (key === 'VAPID_SUBJECT') return 'mailto:admin@quanlykhupho.vn';
        return null;
      }),
    };

    cryptoServiceMock = {
      encrypt: vi.fn((val: string) => `encrypted_${val}`),
      decrypt: vi.fn((val: string) => val.replace('encrypted_', '')),
    };

    metricsServiceMock = {
      recordPushAttempt: vi.fn(),
      recordPushSuccess: vi.fn(),
      recordPushFailure: vi.fn(),
      recordPushStalePruned: vi.fn(),
    };

    service = new NotificationsService(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService,
      cryptoServiceMock as unknown as CryptoService,
      metricsServiceMock as unknown as OperationalMetricsService,
    );
    service.onModuleInit();
  });

  it('should initialize VAPID details when configuration is present', () => {
    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:admin@quanlykhupho.vn',
      'test-public-key',
      'test-private-key',
    );
    expect(service.getVapidPublicKey()).toEqual({
      enabled: true,
      publicKey: 'test-public-key',
    });
  });

  it('should create an in-app notification', async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: 'notif-1',
      accountId: 'user-1',
      title: 'Title',
      content: 'Content',
      type: 'announcement',
      referenceId: 'ref-1',
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    });

    const res = await service.createNotification(prismaMock as unknown as PrismaService, {
      accountId: 'user-1',
      title: 'Title',
      content: 'Content',
      type: NotificationType.ANNOUNCEMENT,
      referenceId: 'ref-1',
    });

    expect(res.id).toBe('notif-1');
    expect(res.accountId).toBe('user-1');
  });

  it('should mark single and all notifications as read', async () => {
    prismaMock.notification.findUnique.mockResolvedValue({
      id: 'notif-1',
      accountId: 'user-1',
      isRead: false,
    });
    prismaMock.notification.update.mockResolvedValue({
      id: 'notif-1',
      accountId: 'user-1',
      title: 'T',
      content: 'C',
      type: 'announcement',
      referenceId: null,
      isRead: true,
      readAt: new Date(),
      createdAt: new Date(),
    });

    const marked = await service.markAsRead('user-1', 'notif-1');
    expect(marked.isRead).toBe(true);

    prismaMock.notification.updateMany.mockResolvedValue({ count: 5 });
    const all = await service.markAllAsRead('user-1');
    expect(all.updatedCount).toBe(5);
  });

  it('should encrypt auth secret when subscribing to push notifications', async () => {
    prismaMock.pushSubscription.upsert.mockResolvedValue({});

    const result = await service.subscribePush('user-1', {
      endpoint: 'https://push.example.com/sub/123',
      keys: {
        p256dh: 'public-key-p256dh',
        auth: 'plain-auth-secret',
      },
      userAgent: 'TestBrowser/1.0',
    });

    expect(result.success).toBe(true);
    expect(cryptoServiceMock.encrypt).toHaveBeenCalledWith('plain-auth-secret');
    expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.com/sub/123' },
      create: {
        accountId: 'user-1',
        endpoint: 'https://push.example.com/sub/123',
        p256dh: 'public-key-p256dh',
        auth: 'encrypted_plain-auth-secret',
        userAgent: 'TestBrowser/1.0',
      },
      update: {
        accountId: 'user-1',
        p256dh: 'public-key-p256dh',
        auth: 'encrypted_plain-auth-secret',
        userAgent: 'TestBrowser/1.0',
      },
    });
  });

  it('should decrypt auth secret before sending push notification and record attempt and success metrics', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        endpoint: 'https://push.example.com/sub/1',
        p256dh: 'public-key-1',
        auth: 'encrypted_auth-secret-1',
      },
    ]);

    const mockedSend = vi.mocked(webpush.sendNotification);
    mockedSend.mockResolvedValueOnce({} as webpush.SendResult);

    await service.sendPushNotifications(['user-1'], {
      title: 'Hello',
      body: 'World',
    });

    expect(cryptoServiceMock.decrypt).toHaveBeenCalledWith('encrypted_auth-secret-1');
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example.com/sub/1',
        keys: {
          p256dh: 'public-key-1',
          auth: 'auth-secret-1',
        },
      },
      expect.any(String),
    );

    expect(metricsServiceMock.recordPushAttempt).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushSuccess).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushFailure).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushStalePruned).not.toHaveBeenCalled();
  });

  it('should record push failure when decrypting auth secret fails and not attempt send', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-corrupt',
        endpoint: 'https://push.example.com/sub/corrupt',
        p256dh: 'public-key-corrupt',
        auth: 'corrupt-auth-data',
      },
    ]);

    cryptoServiceMock.decrypt.mockImplementationOnce(() => {
      throw new Error('Decryption failed');
    });

    const mockedSend = vi.mocked(webpush.sendNotification);

    await service.sendPushNotifications(['user-1'], {
      title: 'Hello',
      body: 'World',
    });

    expect(mockedSend).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushAttempt).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushFailure).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushSuccess).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushStalePruned).not.toHaveBeenCalled();
  });

  it('should send push notification and prune 404/410 subscriptions, recording attempt, failure and stalePruned metrics', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-valid',
        endpoint: 'https://push.example.com/1',
        p256dh: 'key1',
        auth: 'encrypted_auth1',
      },
      {
        id: 'sub-expired',
        endpoint: 'https://push.example.com/2',
        p256dh: 'key2',
        auth: 'encrypted_auth2',
      },
    ]);

    const mockedSend = vi.mocked(webpush.sendNotification);
    mockedSend.mockResolvedValueOnce({} as webpush.SendResult);
    mockedSend.mockRejectedValueOnce({ statusCode: 410 });

    await service.sendPushNotifications(['user-1'], {
      title: 'Hello',
      body: 'World',
    });

    expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: 'sub-expired' },
    });
    expect(metricsServiceMock.recordPushAttempt).toHaveBeenCalledTimes(2);
    expect(metricsServiceMock.recordPushSuccess).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushFailure).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushStalePruned).toHaveBeenCalledTimes(1);
  });

  it('should record push failure but not stalePruned when 404/410 deletion throws', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-expired',
        endpoint: 'https://push.example.com/expired',
        p256dh: 'key-exp',
        auth: 'encrypted_exp',
      },
    ]);

    const mockedSend = vi.mocked(webpush.sendNotification);
    mockedSend.mockRejectedValueOnce({ statusCode: 404 });
    prismaMock.pushSubscription.delete.mockRejectedValueOnce(new Error('Prisma delete failure'));

    await service.sendPushNotifications(['user-1'], {
      title: 'Hello',
      body: 'World',
    });

    expect(metricsServiceMock.recordPushAttempt).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushFailure).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushSuccess).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushStalePruned).not.toHaveBeenCalled();
  });

  it('should record push failure for transient delivery errors without pruning', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      {
        id: 'sub-transient',
        endpoint: 'https://push.example.com/transient',
        p256dh: 'key-transient',
        auth: 'encrypted_transient',
      },
    ]);

    const mockedSend = vi.mocked(webpush.sendNotification);
    mockedSend.mockRejectedValueOnce({ statusCode: 500 });

    await service.sendPushNotifications(['user-1'], {
      title: 'Hello',
      body: 'World',
    });

    expect(prismaMock.pushSubscription.delete).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushAttempt).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushFailure).toHaveBeenCalledTimes(1);
    expect(metricsServiceMock.recordPushSuccess).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushStalePruned).not.toHaveBeenCalled();
  });

  it('should not record any push metrics when VAPID is unconfigured', async () => {
    const unconfiguredConfigMock = {
      get: vi.fn(() => null),
    };
    const unconfiguredService = new NotificationsService(
      prismaMock as unknown as PrismaService,
      unconfiguredConfigMock as unknown as ConfigService,
      cryptoServiceMock as unknown as CryptoService,
      metricsServiceMock as unknown as OperationalMetricsService,
    );
    unconfiguredService.onModuleInit();

    await unconfiguredService.sendPushNotifications(['user-1'], {
      title: 'Hello',
      body: 'World',
    });

    expect(metricsServiceMock.recordPushAttempt).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushSuccess).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushFailure).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushStalePruned).not.toHaveBeenCalled();
  });

  it('should not record any push metrics when accountIds is empty or zero subscriptions exist', async () => {
    await service.sendPushNotifications([], {
      title: 'Hello',
      body: 'World',
    });
    expect(metricsServiceMock.recordPushAttempt).not.toHaveBeenCalled();

    prismaMock.pushSubscription.findMany.mockResolvedValueOnce([]);
    await service.sendPushNotifications(['user-1'], {
      title: 'Hello',
      body: 'World',
    });
    expect(metricsServiceMock.recordPushAttempt).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushSuccess).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushFailure).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushStalePruned).not.toHaveBeenCalled();
  });

  it('should not record any push metrics if querying subscriptions throws an error', async () => {
    prismaMock.pushSubscription.findMany.mockRejectedValueOnce(new Error('DB connection refused'));

    await service.sendPushNotifications(['user-1'], {
      title: 'Hello',
      body: 'World',
    });

    expect(metricsServiceMock.recordPushAttempt).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushSuccess).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushFailure).not.toHaveBeenCalled();
    expect(metricsServiceMock.recordPushStalePruned).not.toHaveBeenCalled();
  });

  it('should never throw error if push notification delivery fails', async () => {
    prismaMock.pushSubscription.findMany.mockRejectedValue(new Error('Network error'));
    await expect(
      service.sendPushNotifications(['user-1'], {
        title: 'Hello',
        body: 'World',
      }),
    ).resolves.not.toThrow();
  });
});
