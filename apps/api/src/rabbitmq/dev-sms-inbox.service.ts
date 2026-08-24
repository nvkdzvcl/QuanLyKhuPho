import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevSmsInboxItemDto } from '@quanlykhupho/shared-types';
import { maskPhoneNumber } from '../security/phone-utils';

export const MAX_DEV_SMS_INBOX_SIZE = 20;
export const DEV_SMS_INBOX_TTL_MS = 300_000;

interface StoredDevSmsInboxItem extends DevSmsInboxItemDto {
  expiresAtMs: number;
}

/**
 * Checks if the direct socket remote address is a loopback address.
 * Allows 127.0.0.1, ::1, and IPv4-mapped 127.0.0.1 (e.g. ::ffff:127.0.0.1).
 * Never trusts forwarded headers.
 */
export function isLoopbackAddress(remoteAddress?: string | null): boolean {
  if (!remoteAddress || typeof remoteAddress !== 'string') {
    return false;
  }
  const addr = remoteAddress.trim().toLowerCase();
  if (addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1') {
    return true;
  }
  if (addr.startsWith('127.') || addr.startsWith('::ffff:127.')) {
    return true;
  }
  return false;
}

@Injectable()
export class DevSmsInboxService {
  private readonly entries: StoredDevSmsInboxItem[] = [];
  private readonly maxEntries = MAX_DEV_SMS_INBOX_SIZE;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns true only when NODE_ENV is strictly 'development' and SMS_PROVIDER is strictly 'memory'
   * (including development default where SMS_PROVIDER resolves to 'memory').
   */
  isEnabled(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv !== 'development') {
      return false;
    }

    const providerType =
      this.configService.get<string>('SMS_PROVIDER') || 'memory';

    return providerType === 'memory';
  }

  /**
   * Captures an OTP after successful queue publication.
   * Phone number is masked before storing.
   */
  recordOtp(
    commandId: string,
    phone: string,
    otpCode: string,
    createdAt?: string,
  ): void {
    if (!this.isEnabled()) {
      return;
    }

    const item: DevSmsInboxItemDto = {
      commandId,
      maskedPhone: maskPhoneNumber(phone),
      otpCode,
      createdAt: createdAt || new Date().toISOString(),
    };

    this.pruneExpired();
    this.entries.unshift({
      ...item,
      expiresAtMs: Date.now() + DEV_SMS_INBOX_TTL_MS,
    });
    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries;
    }
  }

  /**
   * Returns defensive copies of all retained inbox entries, newest first.
   */
  getInbox(): DevSmsInboxItemDto[] {
    if (!this.isEnabled()) {
      return [];
    }
    this.pruneExpired();
    return this.entries.map(({ commandId, maskedPhone, otpCode, createdAt }) => ({
      commandId,
      maskedPhone,
      otpCode,
      createdAt,
    }));
  }

  /**
   * Resets inbox state (used for testing).
   */
  clear(): void {
    this.entries.length = 0;
  }

  get count(): number {
    this.pruneExpired();
    return this.entries.length;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      if (this.entries[index]!.expiresAtMs <= now) {
        this.entries.splice(index, 1);
      }
    }
  }
}
