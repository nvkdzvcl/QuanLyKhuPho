import { NotificationType } from './enums';

export interface NotificationDto {
  id: string;
  accountId: string;
  title: string;
  content: string;
  type: NotificationType;
  referenceId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponseDto {
  items: NotificationDto[];
  unreadCount: number;
  total: number;
}

export interface UnreadCountResponseDto {
  unreadCount: number;
}

export interface PushSubscriptionKeysDto {
  p256dh: string;
  auth: string;
}

export interface RegisterPushSubscriptionDto {
  endpoint: string;
  keys: PushSubscriptionKeysDto;
  userAgent?: string;
}

export interface UnregisterPushSubscriptionDto {
  endpoint: string;
}

export interface VapidPublicKeyResponseDto {
  enabled: boolean;
  publicKey?: string;
}
