import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { RedisService } from '../redis/redis.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { SmsPublisherService } from '../rabbitmq/sms-publisher.service';
import { CryptoService } from '../security/crypto.service';
import { OtpService } from './otp.service';

describe('OtpService', () => {
  let otpService: OtpService;
  let redisService: RedisService;
  let cryptoService: CryptoService;
  let smsPublisherService: SmsPublisherService;
  let rabbitmqService: RabbitMQService;

  beforeEach(async () => {
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

    cryptoService = new CryptoService(configService);
    cryptoService.onModuleInit();

    redisService = new RedisService(configService);
    await redisService.onModuleInit();

    rabbitmqService = new RabbitMQService(configService);
    await rabbitmqService.onModuleInit();

    smsPublisherService = new SmsPublisherService(rabbitmqService, cryptoService);
    otpService = new OtpService(redisService, cryptoService, smsPublisherService);
  });

  describe('sendOtp & Rate Limiting', () => {
    it('should generate 6-digit OTP, store with 300s TTL, and publish encrypted SMS', async () => {
      otpService.setOtpGenerator(() => '654321');
      const phone = '+84912345678';

      const res = await otpService.sendOtp(phone);
      expect(res.expiresIn).toBe(300);
      expect(res.retryAfter).toBe(60);

      // Check stored OTP hash in Redis
      const phoneHash = cryptoService.hashPhone(phone);
      const storedHash = await redisService.get(`otp:hash:${phoneHash}`);
      expect(storedHash).toBe(cryptoService.hashOtp(phoneHash, '654321'));

      // Check published message in RabbitMQ queue
      expect(rabbitmqService.publishedMessages.length).toBe(1);
      const published = rabbitmqService.publishedMessages[0];
      expect(published?.queue).toBe('sms_commands');
      expect(published?.content).not.toContain('+84912345678');
      expect(published?.content).not.toContain('654321');
    });

    it('should enforce 3 sends per 60 seconds rate limit (4th send throws RATE_LIMIT_EXCEEDED)', async () => {
      const phone = '+84912345678';

      // 1st, 2nd, 3rd sends succeed
      await expect(otpService.sendOtp(phone)).resolves.toBeDefined();
      await expect(otpService.sendOtp(phone)).resolves.toBeDefined();
      await expect(otpService.sendOtp(phone)).resolves.toBeDefined();

      // 4th send must be rejected with RATE_LIMIT_EXCEEDED
      try {
        await otpService.sendOtp(phone);
        expect.unreachable('Should have thrown RATE_LIMIT_EXCEEDED');
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).errorCode).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      }
    });
  });

  describe('verifyOtp & Lockout', () => {
    it('should verify correct OTP and reset failed attempts and active hash', async () => {
      const phone = '+84912345678';
      otpService.setOtpGenerator(() => '112233');

      await otpService.sendOtp(phone);

      const isVerified = await otpService.verifyOtp(phone, '112233');
      expect(isVerified).toBe(true);

      const phoneHash = cryptoService.hashPhone(phone);
      const remainingHash = await redisService.get(`otp:hash:${phoneHash}`);
      expect(remainingHash).toBeNull();
    });

    it('should reject wrong OTP and trigger 15-minute lockout on the 3rd consecutive failed attempt', async () => {
      const phone = '+84912345678';
      otpService.setOtpGenerator(() => '998877');

      await otpService.sendOtp(phone);

      // Attempt 1: wrong OTP -> remaining attempts: 2
      await expect(otpService.verifyOtp(phone, '000000')).rejects.toThrow(
        AppException,
      );

      // Attempt 2: wrong OTP -> remaining attempts: 1
      await expect(otpService.verifyOtp(phone, '000001')).rejects.toThrow(
        AppException,
      );

      // Attempt 3: wrong OTP -> triggers 15-minute lockout
      try {
        await otpService.verifyOtp(phone, '000002');
        expect.unreachable('Should have thrown OTP_LOCKED');
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).errorCode).toBe(ErrorCode.OTP_LOCKED);
      }

      // Further verify attempts are locked
      try {
        await otpService.verifyOtp(phone, '998877');
        expect.unreachable('Should remain locked');
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).errorCode).toBe(ErrorCode.OTP_LOCKED);
      }
    });
  });
});
