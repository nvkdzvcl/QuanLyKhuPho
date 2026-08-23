import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';

// Standard Vietnamese 10-digit mobile prefixes: 03x, 05x (052, 055, 056, 058, 059), 07x (070, 076, 077, 078, 079), 08x (081-089), 09x (090-099)
const VN_PHONE_REGEX = /^\+84(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;

/**
 * Normalizes a Vietnamese phone number to canonical E.164 (+84xxxxxxxxx).
 * Throws AppException if the format is invalid.
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new AppException(
      'Số điện thoại không được để trống',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_PHONE_NUMBER,
    );
  }

  const cleaned = raw.trim().replace(/[\s\-.()]/g, '');

  let normalized = cleaned;
  if (cleaned.startsWith('0')) {
    normalized = '+84' + cleaned.slice(1);
  } else if (cleaned.startsWith('84') && !cleaned.startsWith('+')) {
    normalized = '+' + cleaned;
  }

  if (!VN_PHONE_REGEX.test(normalized)) {
    throw new AppException(
      'Số điện thoại không hợp lệ (yêu cầu số di động Việt Nam 10 số hợp lệ)',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_PHONE_NUMBER,
    );
  }

  return normalized;
}

/**
 * Checks if a phone number string is valid without throwing.
 */
export function isValidPhoneNumber(raw: string): boolean {
  try {
    normalizePhoneNumber(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Masks a phone number for safe display in logs and UI (e.g. 091***5678).
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '***';
  const local = phone.startsWith('+84') ? '0' + phone.slice(3) : phone;
  if (local.length < 7) {
    return '***';
  }
  return `${local.slice(0, 3)}***${local.slice(-4)}`;
}
