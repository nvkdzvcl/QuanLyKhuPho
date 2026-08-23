import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Role, AccountStatus as DbAccountStatus } from '@prisma/client';
import {
  AccountStatus,
  ErrorCode,
  RegisterResponseDto,
  SendOtpResponseDto,
  UserDto,
  UserRole,
  VerifyOtpResponseDto,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import { maskPhoneNumber, normalizePhoneNumber } from '../security/phone-utils';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { RegisterDto } from './dto/register.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Request 6-digit OTP code to a normalized phone number.
   */
  async sendOtp(dto: SendOtpDto): Promise<SendOtpResponseDto> {
    const normalizedPhone = normalizePhoneNumber(dto.phoneNumber);
    return this.otpService.sendOtp(normalizedPhone);
  }

  /**
   * Verify OTP and authenticate existing active user or issue single-use register token.
   */
  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{ result: VerifyOtpResponseDto; sessionId?: string }> {
    const normalizedPhone = normalizePhoneNumber(dto.phoneNumber);

    // 1. Verify OTP code
    await this.otpService.verifyOtp(normalizedPhone, dto.otpCode);

    // 2. Lookup account by phoneHash
    const phoneHash = this.cryptoService.hashPhone(normalizedPhone);
    const account = await this.prisma.account.findUnique({
      where: { phoneHash },
      include: { neighborhood: true },
    });

    // Case A: Account already exists
    if (account) {
      // Check status: only active accounts can log in
      if (account.status === DbAccountStatus.pending) {
        throw new AppException(
          'Tài khoản của bạn đang chờ phê duyệt từ Trưởng khu phố.',
          HttpStatus.FORBIDDEN,
          ErrorCode.ACCOUNT_PENDING,
        );
      }

      if (account.status === DbAccountStatus.rejected) {
        throw new AppException(
          `Tài khoản của bạn đã bị từ chối phê duyệt.${account.rejectionReason ? ' Lý do: ' + account.rejectionReason : ''}`,
          HttpStatus.FORBIDDEN,
          ErrorCode.ACCOUNT_REJECTED,
        );
      }

      if (account.status === DbAccountStatus.locked) {
        throw new AppException(
          `Tài khoản của bạn đã bị tạm khóa.${account.lockReason ? ' Lý do: ' + account.lockReason : ''}`,
          HttpStatus.FORBIDDEN,
          ErrorCode.ACCOUNT_LOCKED,
        );
      }

      // Status is ACTIVE -> Create 7-day renewable session in Redis
      const sessionId = await this.sessionService.createSession(
        account.id,
        account.role as unknown as UserRole,
        account.status as unknown as AccountStatus,
        account.neighborhoodId,
      );

      const userDto: UserDto = {
        id: account.id,
        maskedPhone: maskPhoneNumber(normalizedPhone),
        fullName: account.fullName,
        role: account.role as unknown as UserRole,
        status: account.status as unknown as AccountStatus,
        address: account.address,
        neighborhoodId: account.neighborhoodId,
        neighborhood: account.neighborhood
          ? {
              id: account.neighborhood.id,
              code: account.neighborhood.code,
              name: account.neighborhood.name,
              ward: account.neighborhood.ward,
              district: account.neighborhood.district,
              city: account.neighborhood.city,
              description: account.neighborhood.description,
              createdAt: account.neighborhood.createdAt.toISOString(),
              updatedAt: account.neighborhood.updatedAt.toISOString(),
            }
          : null,
        rejectionReason: account.rejectionReason,
        lockReason: account.lockReason,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      };

      return {
        result: {
          isRegistered: true,
          accessToken: sessionId,
          user: userDto,
        },
        sessionId,
      };
    }

    // Case B: Unregistered phone -> Issue single-use register token
    const phoneEncrypted = this.cryptoService.encrypt(normalizedPhone);
    const registerToken = await this.sessionService.createRegisterToken(
      phoneHash,
      phoneEncrypted,
    );

    return {
      result: {
        isRegistered: false,
        registerToken,
        user: null,
      },
    };
  }

  /**
   * Register a new resident account using single-use register token.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    // 1. Validate neighborhood before consuming the single-use token.
    const neighborhood = await this.prisma.neighborhood.findUnique({
      where: { id: dto.neighborhoodId },
    });
    if (!neighborhood) {
      throw new AppException(
        'Khu phố được chọn không tồn tại trong hệ thống.',
        HttpStatus.NOT_FOUND,
        ErrorCode.NEIGHBORHOOD_NOT_FOUND,
      );
    }

    // 2. Atomically consume the single-use register token.
    const tokenData = await this.sessionService.consumeRegisterToken(dto.registerToken);
    if (!tokenData) {
      throw new AppException(
        'Mã xác thực đăng ký không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại từ bước nhập số điện thoại.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_REGISTER_TOKEN,
      );
    }

    // 3. Check for race condition / duplicate phoneHash
    const existing = await this.prisma.account.findUnique({
      where: { phoneHash: tokenData.phoneHash },
    });
    if (existing) {
      throw new AppException(
        'Số điện thoại này đã được đăng ký tài khoản trong hệ thống.',
        HttpStatus.CONFLICT,
        ErrorCode.PHONE_ALREADY_EXISTS,
      );
    }

    // 4. Create new Pending Resident Account
    let createdAccount: Prisma.AccountGetPayload<{ include: { neighborhood: true } }>;
    try {
      createdAccount = await this.prisma.account.create({
        data: {
          phoneEncrypted: tokenData.phoneEncrypted,
          phoneHash: tokenData.phoneHash,
          fullName: dto.fullName.trim(),
          address: dto.address.trim(),
          role: Role.resident,
          status: DbAccountStatus.pending,
          neighborhoodId: dto.neighborhoodId,
        },
        include: { neighborhood: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          'Số điện thoại này đã được đăng ký tài khoản trong hệ thống.',
          HttpStatus.CONFLICT,
          ErrorCode.PHONE_ALREADY_EXISTS,
        );
      }
      throw error;
    }

    const normalizedPhone = this.cryptoService.decrypt(tokenData.phoneEncrypted);

    const userDto: UserDto = {
      id: createdAccount.id,
      maskedPhone: maskPhoneNumber(normalizedPhone),
      fullName: createdAccount.fullName,
      role: createdAccount.role as unknown as UserRole,
      status: createdAccount.status as unknown as AccountStatus,
      address: createdAccount.address,
      neighborhoodId: createdAccount.neighborhoodId,
      neighborhood: {
        id: neighborhood.id,
        code: neighborhood.code,
        name: neighborhood.name,
        ward: neighborhood.ward,
        district: neighborhood.district,
        city: neighborhood.city,
        description: neighborhood.description,
        createdAt: neighborhood.createdAt.toISOString(),
        updatedAt: neighborhood.updatedAt.toISOString(),
      },
      createdAt: createdAccount.createdAt.toISOString(),
      updatedAt: createdAccount.updatedAt.toISOString(),
    };

    return {
      user: userDto,
      message:
        'Đăng ký tài khoản thành công! Hồ sơ của bạn đã được chuyển tới Trưởng khu phố để phê duyệt.',
    };
  }

  /**
   * Destroy session on logout.
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.destroySession(sessionId);
  }
}
