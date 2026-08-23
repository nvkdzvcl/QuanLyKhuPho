import { describe, it, expect } from 'vitest';
import {
  normalizeCitizenId,
  isValidCitizenId,
  maskCitizenId,
  maskEmail,
} from './citizen-id-utils';
import { AppException } from '../core/exceptions/app.exception';

describe('citizen-id-utils', () => {
  describe('normalizeCitizenId', () => {
    it('should normalize a valid 12-digit citizen ID string', () => {
      expect(normalizeCitizenId('012345678901')).toBe('012345678901');
      expect(normalizeCitizenId(' 012345678901 ')).toBe('012345678901');
      expect(normalizeCitizenId('012-345-678-901')).toBe('012345678901');
    });

    it('should throw AppException for invalid length or non-digits', () => {
      expect(() => normalizeCitizenId('')).toThrow(AppException);
      expect(() => normalizeCitizenId('12345')).toThrow(AppException);
      expect(() => normalizeCitizenId('0123456789012')).toThrow(AppException);
      expect(() => normalizeCitizenId('01234567890a')).toThrow(AppException);
    });
  });

  describe('isValidCitizenId', () => {
    it('should return true for valid 12 digits', () => {
      expect(isValidCitizenId('001099001234')).toBe(true);
    });

    it('should return false for invalid inputs', () => {
      expect(isValidCitizenId('')).toBe(false);
      expect(isValidCitizenId('001099')).toBe(false);
      expect(isValidCitizenId('abcdefghijkl')).toBe(false);
    });
  });

  describe('maskCitizenId', () => {
    it('should correctly mask 12-digit citizen ID', () => {
      expect(maskCitizenId('001099001234')).toBe('001******234');
    });

    it('should handle invalid or short inputs gracefully', () => {
      expect(maskCitizenId('')).toBe('***');
      expect(maskCitizenId('123')).toBe('***');
    });
  });

  describe('maskEmail', () => {
    it('should mask standard email addresses', () => {
      expect(maskEmail('nguyen.van.a@example.com')).toBe('ng***@example.com');
      expect(maskEmail('ab@test.com')).toBe('a***@test.com');
    });

    it('should return null for empty email', () => {
      expect(maskEmail(null)).toBeNull();
      expect(maskEmail(undefined)).toBeNull();
      expect(maskEmail('')).toBeNull();
    });
  });
});
