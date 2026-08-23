import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, SendOtpResponseDto } from '@quanlykhupho/shared-types';
import {
  OTP_EXPIRES_IN_SECONDS,
  OTP_LOCKOUT_DURATION_SECONDS,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_MAX_SENDS_PER_WINDOW,
  OTP_RATE_LIMIT_WINDOW_SECONDS,
} from '../core/constants';
import { AppException } from '../core/exceptions/app.exception';
import { RedisService } from '../redis/redis.service';
import { SmsPublisherService } from '../rabbitmq/sms-publisher.service';
import { CryptoService } from '../security/crypto.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private otpGenerator: () => string = () =>
    crypto.randomInt(100000, 1000000).toString();

  constructor(
    private readonly redisService: RedisService,
    private readonly cryptoService: CryptoService,
    private readonly smsPublisherService: SmsPublisherService,
  ) {}

  /**
   * Override OTP generator function (used in tests for deterministic OTPs).
   */
  setOtpGenerator(generator: () => string) {
    this.otpGenerator = generator;
  }

  /**
   * Sends a 6-digit OTP to a normalized Vietnamese phone number.
   * Enforces 3 sends per rolling 60 seconds rate limit.
   */
  async sendOtp(normalizedPhone: string): Promise<SendOtpResponseDto> {
    const phoneHash = this.cryptoService.hashPhone(normalizedPhone);
    const rateLimitKey = `otp:rate_limit:${phoneHash}`;
    const lockoutKey = `otp:lockout:${phoneHash}`;

    // 1. Check if phone is currently locked out from previous failed attempts
    const isLocked = await this.redisService.get(lockoutKey);
    if (isLocked) {
      const remainingTtl = await this.redisService.ttl(lockoutKey);
      throw new AppException(
        `Số điện thoại đang bị khóa xác thực do nhập sai quá số lần. Vui lòng thử lại sau ${remainingTtl > 0 ? remainingTtl : OTP_LOCKOUT_DURATION_SECONDS} giây.`,
        HttpStatus.FORBIDDEN,
        ErrorCode.OTP_LOCKED,
      );
    }

    // 2. Atomic Rate Limit: At most 3 sends per rolling 60 seconds
    const rateResult = await this.redisService.checkAndIncrementRateLimit(
      rateLimitKey,
      OTP_MAX_SENDS_PER_WINDOW,
      OTP_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (!rateResult.allowed) {
      throw new AppException(
        `Bạn đã yêu cầu gửi mã quá nhiều lần (tối đa 3 lần/phút). Vui lòng thử lại sau ${rateResult.retryAfter} giây.`,
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.RATE_LIMIT_EXCEEDED,
      );
    }

    // 3. Generate 6-digit OTP and compute keyed hash
    const otpCode = this.otpGenerator();
    const otpHash = this.cryptoService.hashOtp(phoneHash, otpCode);
    const hashKey = `otp:hash:${phoneHash}`;

    // 4. Store keyed hash in Redis with exactly 300 seconds TTL
    await this.redisService.setex(hashKey, OTP_EXPIRES_IN_SECONDS, otpHash);

    // 5. Publish encrypted SMS command to RabbitMQ queue
    await this.smsPublisherService.publishOtpSms(normalizedPhone, otpCode);

    return {
      expiresIn: OTP_EXPIRES_IN_SECONDS,
      retryAfter: rateResult.retryAfter,
    };
  }

  /**
   * Verifies a 6-digit OTP code against the stored keyed hash.
   * Locks out for 15 minutes upon the 3rd consecutive failed attempt.
   * Resets failed attempts upon success.
   */
  async verifyOtp(normalizedPhone: string, otpCode: string): Promise<boolean> {
    const phoneHash = this.cryptoService.hashPhone(normalizedPhone);
    const lockoutKey = `otp:lockout:${phoneHash}`;
    const hashKey = `otp:hash:${phoneHash}`;
    const failedKey = `otp:failed:${phoneHash}`;

    // 1. Check if locked out
    const isLocked = await this.redisService.get(lockoutKey);
    if (isLocked) {
      const remainingTtl = await this.redisService.ttl(lockoutKey);
      throw new AppException(
        `Tính năng xác thực OTP đang bị tạm khóa 15 phút do nhập sai quá 3 lần. Còn lại ${remainingTtl > 0 ? remainingTtl : OTP_LOCKOUT_DURATION_SECONDS} giây.`,
        HttpStatus.FORBIDDEN,
        ErrorCode.OTP_LOCKED,
      );
    }

    // 2. Fetch stored hash
    const storedHash = await this.redisService.get(hashKey);
    if (!storedHash) {
      throw new AppException(
        'Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng gửi lại mã mới.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.OTP_EXPIRED,
      );
    }

    // 3. Verify OTP
    if (!this.cryptoService.verifyOtpHash(storedHash, phoneHash, otpCode)) {
      // Record failed attempt atomically
      const failResult = await this.redisService.recordFailedOtpAttempt(
        failedKey,
        lockoutKey,
        hashKey,
        OTP_MAX_FAILED_ATTEMPTS,
        OTP_LOCKOUT_DURATION_SECONDS,
      );

      if (failResult.isLocked) {
        throw new AppException(
          'Bạn đã nhập sai mã OTP 3 lần liên tiếp. Tính năng xác thực bị tạm khóa 15 phút.',
          HttpStatus.FORBIDDEN,
          ErrorCode.OTP_LOCKED,
        );
      } else {
        throw new AppException(
          `Mã OTP không chính xác. Bạn còn ${failResult.remainingAttempts} lần thử.`,
          HttpStatus.BAD_REQUEST,
          ErrorCode.INVALID_OTP,
        );
      }
    }

    // 4. Success: Reset invalid-attempt count and delete active OTP hash
    await this.redisService.del(hashKey);
    await this.redisService.del(failedKey);
    await this.redisService.del(lockoutKey);

    return true;
  }
}
