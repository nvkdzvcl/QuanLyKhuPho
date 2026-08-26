import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import {
  ErrorCode,
  NotificationDto,
  NotificationListResponseDto,
  NotificationType,
  UnreadCountResponseDto,
  VapidPublicKeyResponseDto,
} from '@quanlykhupho/shared-types';
import { Prisma, NotificationType as DbNotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../core/exceptions/app.exception';
import { RegisterPushSubscriptionDto } from './dto/register-push.dto';
import { CryptoService } from '../security/crypto.service';
import { OperationalMetricsService } from '../observability/operational-metrics.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private isPushConfigured = false;
  private vapidPublicKey?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly metricsService: OperationalMetricsService,
  ) {}

  onModuleInit() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT');

    if (publicKey && privateKey && subject) {
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.isPushConfigured = true;
        this.vapidPublicKey = publicKey;
        this.logger.log('Web Push service configured with VAPID');
      } catch {
        this.logger.warn('Failed to initialize Web Push VAPID configuration');
      }
    } else {
      this.logger.log('Web Push VAPID is not configured; running in in-app notification only mode');
    }
  }

  getVapidPublicKey(): VapidPublicKeyResponseDto {
    return {
      enabled: this.isPushConfigured,
      publicKey: this.vapidPublicKey,
    };
  }

  /**
   * Creates an in-app notification within an existing transaction or standalone.
   */
  async createNotification(
    tx: Prisma.TransactionClient | PrismaService,
    data: {
      accountId: string;
      title: string;
      content: string;
      type: NotificationType;
      referenceId?: string | null;
    },
  ): Promise<NotificationDto> {
    const created = await tx.notification.create({
      data: {
        accountId: data.accountId,
        title: data.title,
        content: data.content,
        type: data.type as unknown as DbNotificationType,
        referenceId: data.referenceId || null,
      },
    });

    return {
      id: created.id,
      accountId: created.accountId,
      title: created.title,
      content: created.content,
      type: created.type as unknown as NotificationType,
      referenceId: created.referenceId,
      isRead: created.isRead,
      readAt: created.readAt?.toISOString() || null,
      createdAt: created.createdAt.toISOString(),
    };
  }

  /**
   * Creates batch in-app notifications for multiple recipients atomically.
   */
  async createBatchNotifications(
    tx: Prisma.TransactionClient,
    accountIds: string[],
    data: {
      title: string;
      content: string;
      type: NotificationType;
      referenceId?: string | null;
    },
  ): Promise<number> {
    if (!accountIds || accountIds.length === 0) {
      return 0;
    }

    const records = accountIds.map((accountId) => ({
      accountId,
      title: data.title,
      content: data.content,
      type: data.type as unknown as DbNotificationType,
      referenceId: data.referenceId || null,
    }));

    const result = await tx.notification.createMany({
      data: records,
    });

    return result.count;
  }

  /**
   * Retrieves paginated in-app notifications for the current user.
   */
  async getNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<NotificationListResponseDto> {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const [items, unreadCount, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { accountId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.notification.count({
        where: { accountId: userId, isRead: false },
      }),
      this.prisma.notification.count({
        where: { accountId: userId },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        accountId: item.accountId,
        title: item.title,
        content: item.content,
        type: item.type as unknown as NotificationType,
        referenceId: item.referenceId,
        isRead: item.isRead,
        readAt: item.readAt?.toISOString() || null,
        createdAt: item.createdAt.toISOString(),
      })),
      unreadCount,
      total,
    };
  }

  /**
   * Returns unread notification count for the current user.
   */
  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.prisma.notification.count({
      where: { accountId: userId, isRead: false },
    });
    return { unreadCount };
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.accountId !== userId) {
      throw new AppException(
        'Không tìm thấy thông báo.',
        HttpStatus.NOT_FOUND,
        ErrorCode.NOTIFICATION_NOT_FOUND,
      );
    }

    if (notification.isRead) {
      return {
        id: notification.id,
        accountId: notification.accountId,
        title: notification.title,
        content: notification.content,
        type: notification.type as unknown as NotificationType,
        referenceId: notification.referenceId,
        isRead: notification.isRead,
        readAt: notification.readAt?.toISOString() || null,
        createdAt: notification.createdAt.toISOString(),
      };
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      id: updated.id,
      accountId: updated.accountId,
      title: updated.title,
      content: updated.content,
      type: updated.type as unknown as NotificationType,
      referenceId: updated.referenceId,
      isRead: updated.isRead,
      readAt: updated.readAt?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { accountId: userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  /**
   * Registers or updates a web push subscription for the current user.
   */
  async subscribePush(
    userId: string,
    dto: RegisterPushSubscriptionDto,
  ): Promise<{ success: boolean }> {
    const encryptedAuth = this.cryptoService.encrypt(dto.keys.auth);

    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        accountId: userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: encryptedAuth,
        userAgent: dto.userAgent || null,
      },
      update: {
        accountId: userId,
        p256dh: dto.keys.p256dh,
        auth: encryptedAuth,
        userAgent: dto.userAgent || null,
      },
    });

    return { success: true };
  }

  /**
   * Unregisters a web push subscription.
   */
  async unsubscribePush(
    userId: string,
    endpoint: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.pushSubscription.deleteMany({
      where: {
        accountId: userId,
        endpoint,
      },
    });

    return { success: true };
  }

  /**
   * Best-effort background Web Push sender.
   * Never throws error to the caller, never rolls back callers, and prunes stale subscriptions (404/410).
   * Plaintext endpoints, auth keys, and secrets are NEVER logged.
   */
  async sendPushNotifications(
    accountIds: string[],
    payload: {
      title: string;
      body: string;
      referenceId?: string;
      url?: string;
    },
  ): Promise<void> {
    if (!this.isPushConfigured || !accountIds || accountIds.length === 0) {
      return;
    }

    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { accountId: { in: accountIds } },
      });

      if (subscriptions.length === 0) {
        return;
      }

      const pushPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        data: {
          referenceId: payload.referenceId,
          url: payload.url || '/',
        },
      });

      let sentCount = 0;
      let prunedCount = 0;

      for (const sub of subscriptions) {
        this.metricsService.recordPushAttempt();
        try {
          let decryptedAuth: string;
          try {
            decryptedAuth = this.cryptoService.decrypt(sub.auth);
          } catch {
            this.logger.warn('Failed to decrypt push subscription auth secret');
            this.metricsService.recordPushFailure();
            continue;
          }

          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: decryptedAuth,
              },
            },
            pushPayload,
          );
          sentCount++;
          this.metricsService.recordPushSuccess();
        } catch (error: unknown) {
          this.metricsService.recordPushFailure();

          const statusCode =
            error && typeof error === 'object' && 'statusCode' in error
              ? (error as { statusCode: number }).statusCode
              : undefined;

          // Prune stale or revoked subscriptions (404 Not Found or 410 Gone)
          if (statusCode === 404 || statusCode === 410) {
            try {
              await this.prisma.pushSubscription.delete({
                where: { id: sub.id },
              });
              prunedCount++;
              this.metricsService.recordPushStalePruned();
            } catch {
              // Ignore deletion error
            }
          }
        }
      }

      this.logger.log(
        `Web Push batch finished: ${sentCount} sent successfully, ${prunedCount} stale subscriptions pruned.`,
      );
    } catch {
      this.logger.warn('Web Push delivery encountered a transient error; durable in-app notifications are preserved.');
    }
  }
}
