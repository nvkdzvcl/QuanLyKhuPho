import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';

const CITIZEN_ID_REGEX = /^\d{12}$/;

/**
 * Normalizes and validates a 12-digit Vietnamese Citizen ID (CCCD).
 * Throws AppException if invalid.
 */
export function normalizeCitizenId(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new AppException(
      'Số Căn cước công dân không được để trống.',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_CITIZEN_ID,
    );
  }

  const cleaned = raw.trim().replace(/[\s-]/g, '');

  if (!CITIZEN_ID_REGEX.test(cleaned)) {
    throw new AppException(
      'Số Căn cước công dân không hợp lệ (yêu cầu đúng 12 chữ số).',
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_CITIZEN_ID,
    );
  }

  return cleaned;
}

/**
 * Checks if a citizen ID is valid without throwing.
 */
export function isValidCitizenId(raw: string): boolean {
  try {
    normalizeCitizenId(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Masks a 12-digit citizen ID for safe display in list views and logs (e.g., 012******789).
 */
export function maskCitizenId(citizenId: string): string {
  if (!citizenId || typeof citizenId !== 'string') return '***';
  const cleaned = citizenId.trim();
  if (cleaned.length < 6) return '***';
  return `${cleaned.slice(0, 3)}******${cleaned.slice(-3)}`;
}

/**
 * Masks an email address for safe display (e.g., a***@domain.com).
 */
export function maskEmail(email?: string | null): string | null {
  if (!email || typeof email !== 'string') return null;
  const parts = email.trim().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return '***';
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}
