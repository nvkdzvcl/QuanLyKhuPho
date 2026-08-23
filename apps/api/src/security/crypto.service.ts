import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private encryptionKey!: Buffer;
  private hashKey!: Buffer;
  private otpPepper!: string;
  private queueEncryptionKey!: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const rawEncKey = this.configService.get<string>('PHONE_ENCRYPTION_KEY');
    const rawHashKey = this.configService.get<string>('PHONE_HASH_KEY');
    const rawOtpPepper = this.configService.get<string>('OTP_PEPPER');
    const rawQueueKey = this.configService.get<string>('SMS_QUEUE_ENCRYPTION_KEY');
    this.otpPepper = rawOtpPepper || 'default_dev_otp_pepper_secret_32_bytes!';

    // Validate or derive 32-byte encryption key
    if (rawEncKey) {
      if (rawEncKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawEncKey)) {
        this.encryptionKey = Buffer.from(rawEncKey, 'hex');
      } else {
        throw new Error('PHONE_ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
      }
    } else {
      if (isProduction) throw new Error('PHONE_ENCRYPTION_KEY is required in production');
      this.logger.warn(
        'PHONE_ENCRYPTION_KEY not set in environment; using fallback key for development',
      );
      this.encryptionKey = crypto
        .createHash('sha256')
        .update('dev_phone_encryption_key_fallback_value_32_bytes')
        .digest();
    }

    // Validate or derive 32-byte hash key
    if (rawHashKey) {
      if (rawHashKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawHashKey)) {
        this.hashKey = Buffer.from(rawHashKey, 'hex');
      } else {
        throw new Error('PHONE_HASH_KEY must be exactly 64 hexadecimal characters');
      }
    } else {
      if (isProduction) throw new Error('PHONE_HASH_KEY is required in production');
      this.logger.warn(
        'PHONE_HASH_KEY not set in environment; using fallback key for development',
      );
      this.hashKey = crypto
        .createHash('sha256')
        .update('dev_phone_hash_key_fallback_value_32_bytes')
        .digest();
    }

    // Validate or derive 32-byte dedicated SMS queue encryption key
    if (rawQueueKey) {
      if (rawQueueKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawQueueKey)) {
        this.queueEncryptionKey = Buffer.from(rawQueueKey, 'hex');
      } else {
        throw new Error('SMS_QUEUE_ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
      }
    } else {
      if (isProduction) throw new Error('SMS_QUEUE_ENCRYPTION_KEY is required in production');
      this.logger.warn(
        'SMS_QUEUE_ENCRYPTION_KEY not set in environment; using fallback key for development',
      );
      this.queueEncryptionKey = crypto
        .createHash('sha256')
        .update('dev_sms_queue_encryption_key_fallback_value_32_bytes')
        .digest();
    }

    if (
      this.encryptionKey.length !== 32 ||
      this.hashKey.length !== 32 ||
      this.queueEncryptionKey.length !== 32
    ) {
      throw new Error('Cryptographic keys must resolve to exactly 32 bytes (256 bits).');
    }
    if (isProduction && (!rawOtpPepper || rawOtpPepper.length < 32)) {
      throw new Error('OTP_PEPPER must contain at least 32 characters in production');
    }
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a fresh random 12-byte IV per value.
   * Format: iv_hex:authTag_hex:ciphertext_hex
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts ciphertext produced by encrypt().
   */
  decrypt(encryptedPayload: string): string {
    const parts = encryptedPayload.split(':');
    const ivHex = parts[0];
    const authTagHex = parts[1];
    const ciphertextHex = parts[2];

    if (parts.length !== 3 || !ivHex || !authTagHex || !ciphertextHex) {
      throw new Error('Invalid encrypted payload format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Computes deterministic HMAC-SHA-256 lookup hash for normalized phone numbers.
   */
  hashPhone(normalizedPhone: string): string {
    return crypto
      .createHmac('sha256', this.hashKey)
      .update(normalizedPhone)
      .digest('hex');
  }

  /**
   * Computes keyed HMAC-SHA-256 hash for OTP codes.
   */
  hashOtp(phoneHash: string, otpCode: string): string {
    return crypto
      .createHmac('sha256', this.otpPepper)
      .update(`${phoneHash}:${otpCode}`)
      .digest('hex');
  }

  verifyOtpHash(expectedHash: string, phoneHash: string, otpCode: string): boolean {
    const actualHash = this.hashOtp(phoneHash, otpCode);
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(actualHash, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  /**
   * Encrypts a JSON payload for message queues (RabbitMQ) using dedicated SMS_QUEUE_ENCRYPTION_KEY.
   */
  encryptQueuePayload(data: Record<string, unknown>): string {
    const json = JSON.stringify(data);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.queueEncryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(json, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts a queue payload encrypted with encryptQueuePayload().
   */
  decryptQueuePayload<T = Record<string, unknown>>(encryptedData: string): T {
    const parts = encryptedData.split(':');
    const ivHex = parts[0];
    const authTagHex = parts[1];
    const ciphertextHex = parts[2];

    if (parts.length !== 3 || !ivHex || !authTagHex || !ciphertextHex) {
      throw new Error('Invalid encrypted queue payload format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.queueEncryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8')) as T;
  }
}
