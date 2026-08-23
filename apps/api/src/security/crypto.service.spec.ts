import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    const configService = {
      get: (key: string) => {
        if (key === 'PHONE_ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (key === 'PHONE_HASH_KEY') {
          return 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
        }
        if (key === 'OTP_PEPPER') {
          return 'test_otp_pepper_secret_key_32_bytes!';
        }
        return undefined;
      },
    } as unknown as ConfigService;

    service = new CryptoService(configService);
    service.onModuleInit();
  });

  describe('AES-256-GCM Encryption & Decryption', () => {
    it('should encrypt plaintext with random IV and decrypt successfully', () => {
      const plaintext = '+84912345678';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      // Fresh IV per encryption -> ciphertexts should be different
      expect(encrypted1).not.toBe(encrypted2);

      // Decryption must restore exact plaintext
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should fail decryption if auth tag or ciphertext is tampered with', () => {
      const plaintext = 'Sensitive resident info';
      const encrypted = service.encrypt(plaintext);
      const parts = encrypted.split(':');

      // Tamper ciphertext
      const tamperedParts = [parts[0], parts[1], 'ff' + parts[2]?.slice(2)];
      const tamperedPayload = tamperedParts.join(':');

      expect(() => service.decrypt(tamperedPayload)).toThrow();
    });
  });

  describe('HMAC-SHA-256 Phone Lookup Hash', () => {
    it('should generate deterministic blind index hash for same normalized phone', () => {
      const phone = '+84912345678';
      const hash1 = service.hashPhone(phone);
      const hash2 = service.hashPhone(phone);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // 256 bits hex
      expect(hash1).not.toBe(phone);
    });

    it('should generate distinct hashes for different phone numbers', () => {
      const hash1 = service.hashPhone('+84912345678');
      const hash2 = service.hashPhone('+84912345679');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Keyed OTP Hashing', () => {
    it('should produce deterministic hash for phone + OTP code', () => {
      const phoneHash = service.hashPhone('+84912345678');
      const otp = '123456';
      const otpHash1 = service.hashOtp(phoneHash, otp);
      const otpHash2 = service.hashOtp(phoneHash, otp);

      expect(otpHash1).toBe(otpHash2);
      expect(otpHash1.length).toBe(64);
    });
  });

  describe('Queue Payload Protection', () => {
    it('should encrypt queue payload so plaintext phone/OTP is not exposed at rest', () => {
      const sensitiveData = {
        type: 'OTP',
        phone: '+84912345678',
        otp: '654321',
      };

      const encrypted = service.encryptQueuePayload(sensitiveData);

      // Ciphertext must not contain plaintext phone or OTP
      expect(encrypted).not.toContain('+84912345678');
      expect(encrypted).not.toContain('654321');

      // Decryption recovers full data
      const decrypted = service.decryptQueuePayload<typeof sensitiveData>(encrypted);
      expect(decrypted).toEqual(sensitiveData);
    });
  });
});
