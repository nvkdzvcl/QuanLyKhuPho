import { describe, it, expect } from 'vitest';
import type { DevSmsInboxItemDto } from '@quanlykhupho/shared-types';
import {
  findMatchingDevOtp,
  maskPhoneNumberClient,
} from '../src/components/auth/dev-sms-inbox';

describe('DevSmsInbox - Web Unit Tests', () => {
  describe('maskPhoneNumberClient', () => {
    it('masks standard 10-digit Vietnamese local format (0912345678)', () => {
      expect(maskPhoneNumberClient('0912345678')).toBe('091***5678');
      expect(maskPhoneNumberClient('0987654321')).toBe('098***4321');
    });

    it('masks international E.164 format (+84912345678)', () => {
      expect(maskPhoneNumberClient('+84912345678')).toBe('091***5678');
      expect(maskPhoneNumberClient('+84987654321')).toBe('098***4321');
    });

    it('masks un-prefixed country code format (84912345678)', () => {
      expect(maskPhoneNumberClient('84912345678')).toBe('091***5678');
    });

    it('cleans formatted phone strings with dashes, spaces, and brackets', () => {
      expect(maskPhoneNumberClient('091-234-5678')).toBe('091***5678');
      expect(maskPhoneNumberClient('(091) 234 5678')).toBe('091***5678');
      expect(maskPhoneNumberClient('+84 912 345 678')).toBe('091***5678');
    });

    it('returns fallback *** for invalid or short inputs', () => {
      expect(maskPhoneNumberClient('')).toBe('***');
      expect(maskPhoneNumberClient('12345')).toBe('***');
    });
  });

  describe('findMatchingDevOtp - Frontend Message Selection', () => {
    const mockInbox: DevSmsInboxItemDto[] = [
      {
        commandId: 'cmd-3',
        maskedPhone: '091***5678',
        otpCode: '333333',
        createdAt: '2026-08-24T00:00:03Z',
      },
      {
        commandId: 'cmd-2',
        maskedPhone: '098***4321',
        otpCode: '222222',
        createdAt: '2026-08-24T00:00:02Z',
      },
      {
        commandId: 'cmd-1',
        maskedPhone: '091***5678',
        otpCode: '111111',
        createdAt: '2026-08-24T00:00:01Z',
      },
    ];

    it('selects the latest OTP matching the target phone number (newest-first priority)', () => {
      // Both cmd-3 and cmd-1 match 0912345678, cmd-3 is the newest
      const matched = findMatchingDevOtp(mockInbox, '0912345678');
      expect(matched).not.toBeNull();
      expect(matched?.commandId).toBe('cmd-3');
      expect(matched?.otpCode).toBe('333333');
      expect(matched?.maskedPhone).toBe('091***5678');
    });

    it('matches when target phone is in +84 international format', () => {
      const matched = findMatchingDevOtp(mockInbox, '+84987654321');
      expect(matched).not.toBeNull();
      expect(matched?.commandId).toBe('cmd-2');
      expect(matched?.otpCode).toBe('222222');
      expect(matched?.maskedPhone).toBe('098***4321');
    });

    it('returns null if no entry matches the phone number', () => {
      const matched = findMatchingDevOtp(mockInbox, '0901234567');
      expect(matched).toBeNull();
    });

    it('returns null for empty inbox or empty phone number', () => {
      expect(findMatchingDevOtp([], '0912345678')).toBeNull();
      expect(findMatchingDevOtp(mockInbox, '')).toBeNull();
    });
  });
});
