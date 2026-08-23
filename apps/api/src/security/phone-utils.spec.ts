import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  maskPhoneNumber,
} from './phone-utils';
import { AppException } from '../core/exceptions/app.exception';

describe('PhoneUtils', () => {
  describe('normalizePhoneNumber', () => {
    it('should normalize standard 10-digit Vietnamese phone numbers starting with 0', () => {
      expect(normalizePhoneNumber('0912345678')).toBe('+84912345678');
      expect(normalizePhoneNumber('0387654321')).toBe('+84387654321');
      expect(normalizePhoneNumber('0771234567')).toBe('+84771234567');
      expect(normalizePhoneNumber('0839998888')).toBe('+84839998888');
      expect(normalizePhoneNumber('0581234567')).toBe('+84581234567');
    });

    it('should normalize phone numbers with dots, spaces, dashes and parentheses', () => {
      expect(normalizePhoneNumber('091.234.5678')).toBe('+84912345678');
      expect(normalizePhoneNumber('091 234 5678')).toBe('+84912345678');
      expect(normalizePhoneNumber('091-234-5678')).toBe('+84912345678');
      expect(normalizePhoneNumber('(091) 234 5678')).toBe('+84912345678');
    });

    it('should normalize numbers already starting with 84 or +84', () => {
      expect(normalizePhoneNumber('84912345678')).toBe('+84912345678');
      expect(normalizePhoneNumber('+84912345678')).toBe('+84912345678');
      expect(normalizePhoneNumber('+84 91 234 5678')).toBe('+84912345678');
    });

    it('should reject invalid phone numbers', () => {
      expect(() => normalizePhoneNumber('')).toThrow(AppException);
      expect(() => normalizePhoneNumber('12345')).toThrow(AppException);
      expect(() => normalizePhoneNumber('0123456789')).toThrow(AppException); // invalid prefix 01
      expect(() => normalizePhoneNumber('091234567899')).toThrow(AppException); // too long
      expect(() => normalizePhoneNumber('091234567')).toThrow(AppException); // too short
      expect(() => normalizePhoneNumber('abcdefghij')).toThrow(AppException);
      expect(() => normalizePhoneNumber('02838221234')).toThrow(AppException); // landline
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should return true for valid phone numbers and false for invalid ones', () => {
      expect(isValidPhoneNumber('0912345678')).toBe(true);
      expect(isValidPhoneNumber('+84912345678')).toBe(true);
      expect(isValidPhoneNumber('invalid')).toBe(false);
      expect(isValidPhoneNumber('02838221234')).toBe(false);
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask phone numbers properly for UI display', () => {
      expect(maskPhoneNumber('+84912345678')).toBe('091***5678');
      expect(maskPhoneNumber('0912345678')).toBe('091***5678');
      expect(maskPhoneNumber('+84387654321')).toBe('038***4321');
      expect(maskPhoneNumber('')).toBe('***');
    });
  });
});
