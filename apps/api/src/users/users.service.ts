import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  Account,
  Neighborhood,
  Prisma,
  Role,
  AccountStatus as DbAccountStatus,
} from '@prisma/client';
import {
  AccountStatus,
  CreateLeaderDto,
  ErrorCode,
  LockResidentDto,
  ManagedResidentQueryDto,
  RejectResidentDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { SmsPublisherService } from '../rabbitmq/sms-publisher.service';
import { CryptoService } from '../security/crypto.service';
import { maskPhoneNumber, normalizePhoneNumber } from '../security/phone-utils';
import { SessionService } from '../auth/session.service';

type AccountWithNeighborhood = Account & {
  neighborhood: Neighborhood | null;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly sessionService: SessionService,
    private readonly smsPublisherService: SmsPublisherService,
  ) {}

  /**
   * Helper to format an Account entity into a safe UserDto.
   */
  private formatUserDto(account: AccountWithNeighborhood): UserDto {
    let masked = '***';
    try {
      if (account.phoneEncrypted) {
        const decrypted = this.cryptoService.decrypt(account.phoneEncrypted);
        masked = maskPhoneNumber(decrypted);
      }
    } catch {
      masked = '***';
    }

    return {
      id: account.id,
      maskedPhone: masked,
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
  }

  /**
   * List pending resident accounts.
   * Leaders can ONLY see pending residents in their assigned neighborhood.
   * Officers can see all pending residents or filter by neighborhood.
   */
  async getPendingResidents(
    currentUser: UserDto,
    neighborhoodId?: string,
  ): Promise<UserDto[]> {
    const where: Prisma.AccountWhereInput = {
      role: Role.resident,
      status: DbAccountStatus.pending,
    };

    if (currentUser.role === UserRole.LEADER) {
      if (!currentUser.neighborhoodId) {
        throw new AppException(
          'Trưởng khu phố chưa được gán vào khu phố nào.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      where.neighborhoodId = currentUser.neighborhoodId;
    } else if (currentUser.role === UserRole.OFFICER) {
      if (neighborhoodId) {
        where.neighborhoodId = neighborhoodId;
      }
    }

    const accounts = await this.prisma.account.findMany({
      where,
      include: { neighborhood: true },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((acc) => this.formatUserDto(acc));
  }

  /**
   * List managed resident accounts (active and locked) for FR-04 moderation.
   * Leaders can ONLY see residents in their assigned neighborhood.
   * Officers can see all managed residents or filter by neighborhood.
   */
  async getManagedResidents(
    currentUser: UserDto,
    query?: ManagedResidentQueryDto,
  ): Promise<UserDto[]> {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chức năng này chỉ dành cho Trưởng khu phố và Cán bộ phường.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const where: Prisma.AccountWhereInput = {
      role: Role.resident,
    };

    if (query?.status) {
      if (
        query.status !== AccountStatus.ACTIVE &&
        query.status !== AccountStatus.LOCKED
      ) {
        throw new AppException(
          'Trạng thái lọc chỉ chấp nhận active hoặc locked.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      where.status =
        query.status === AccountStatus.ACTIVE
          ? DbAccountStatus.active
          : DbAccountStatus.locked;
    } else {
      where.status = {
        in: [DbAccountStatus.active, DbAccountStatus.locked],
      };
    }

    if (currentUser.role === UserRole.LEADER) {
      if (!currentUser.neighborhoodId) {
        throw new AppException(
          'Trưởng khu phố chưa được gán vào khu phố nào.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      where.neighborhoodId = currentUser.neighborhoodId;
    } else if (currentUser.role === UserRole.OFFICER) {
      if (query?.neighborhoodId) {
        where.neighborhoodId = query.neighborhoodId;
      }
    }

    const accounts = await this.prisma.account.findMany({
      where,
      include: { neighborhood: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    return accounts.map((acc) => this.formatUserDto(acc));
  }

  /**
   * Approves a pending resident account.
   * Leaders can only approve residents in their own assigned neighborhood.
   */
  async approveResident(
    residentId: string,
    currentUser: UserDto,
  ): Promise<UserDto> {
    const resident = await this.prisma.account.findUnique({
      where: { id: residentId },
      include: { neighborhood: true },
    });

    if (!resident) {
      throw new AppException(
        'Không tìm thấy thông tin tài khoản cư dân.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ACCOUNT_NOT_FOUND,
      );
    }

    if (resident.role !== Role.resident) {
      throw new AppException(
        'Chức năng này chỉ áp dụng cho tài khoản cư dân.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    // Neighborhood isolation for Leader
    if (currentUser.role === UserRole.LEADER) {
      if (resident.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền thao tác trên cư dân thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    // Validate status transition
    if (resident.status !== DbAccountStatus.pending) {
      throw new AppException(
        `Không thể phê duyệt tài khoản có trạng thái "${resident.status}". Chỉ phê duyệt tài khoản đang chờ (pending).`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_STATUS_TRANSITION,
      );
    }

    // Update status to ACTIVE
    const updated = await this.prisma.account.update({
      where: { id: residentId },
      data: {
        status: DbAccountStatus.active,
        rejectionReason: null,
      },
      include: { neighborhood: true },
    });

    // Send encrypted SMS notification to resident
    try {
      const decryptedPhone = this.cryptoService.decrypt(updated.phoneEncrypted);
      await this.smsPublisherService.publishStatusUpdateSms(
        decryptedPhone,
        AccountStatus.ACTIVE,
      );
    } catch {
      this.logger.warn('Could not publish encrypted SMS notification');
    }

    return this.formatUserDto(updated);
  }

  /**
   * Rejects a pending resident account with a required reason.
   */
  async rejectResident(
    residentId: string,
    dto: RejectResidentDto,
    currentUser: UserDto,
  ): Promise<UserDto> {
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new AppException(
        'Lý do từ chối không được để trống.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.REASON_REQUIRED,
      );
    }

    const resident = await this.prisma.account.findUnique({
      where: { id: residentId },
      include: { neighborhood: true },
    });

    if (!resident) {
      throw new AppException(
        'Không tìm thấy thông tin tài khoản cư dân.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ACCOUNT_NOT_FOUND,
      );
    }

    if (resident.role !== Role.resident) {
      throw new AppException(
        'Chức năng này chỉ áp dụng cho tài khoản cư dân.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    // Neighborhood isolation for Leader
    if (currentUser.role === UserRole.LEADER) {
      if (resident.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền thao tác trên cư dân thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    if (resident.status !== DbAccountStatus.pending) {
      throw new AppException(
        'Chỉ có thể từ chối tài khoản cư dân đang chờ duyệt.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_STATUS_TRANSITION,
      );
    }

    // Update status to REJECTED
    const updated = await this.prisma.account.update({
      where: { id: residentId },
      data: {
        status: DbAccountStatus.rejected,
        rejectionReason: dto.reason.trim(),
      },
      include: { neighborhood: true },
    });

    // Revoke any existing sessions in Redis
    await this.sessionService.revokeUserSessions(resident.id);

    // Send encrypted SMS notification
    try {
      const decryptedPhone = this.cryptoService.decrypt(updated.phoneEncrypted);
      await this.smsPublisherService.publishStatusUpdateSms(
        decryptedPhone,
        AccountStatus.REJECTED,
        dto.reason.trim(),
      );
    } catch {
      this.logger.warn('Could not publish encrypted SMS notification');
    }

    return this.formatUserDto(updated);
  }

  /**
   * Locks an active resident account with a required reason.
   */
  async lockResident(
    residentId: string,
    dto: LockResidentDto,
    currentUser: UserDto,
  ): Promise<UserDto> {
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new AppException(
        'Lý do khóa tài khoản không được để trống.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.REASON_REQUIRED,
      );
    }

    const resident = await this.prisma.account.findUnique({
      where: { id: residentId },
      include: { neighborhood: true },
    });

    if (!resident) {
      throw new AppException(
        'Không tìm thấy thông tin tài khoản.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ACCOUNT_NOT_FOUND,
      );
    }

    if (resident.role !== Role.resident) {
      throw new AppException(
        'Chức năng này chỉ áp dụng cho tài khoản cư dân.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    // Neighborhood isolation for Leader
    if (currentUser.role === UserRole.LEADER) {
      if (resident.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền khóa tài khoản thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    if (resident.status !== DbAccountStatus.active) {
      throw new AppException(
        'Chỉ có thể khóa tài khoản cư dân đang hoạt động.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_STATUS_TRANSITION,
      );
    }

    // Update status to LOCKED
    const updated = await this.prisma.account.update({
      where: { id: residentId },
      data: {
        status: DbAccountStatus.locked,
        lockReason: dto.reason.trim(),
      },
      include: { neighborhood: true },
    });

    // Revoke all active sessions immediately
    await this.sessionService.revokeUserSessions(resident.id);

    // Send encrypted SMS notification
    try {
      const decryptedPhone = this.cryptoService.decrypt(updated.phoneEncrypted);
      await this.smsPublisherService.publishStatusUpdateSms(
        decryptedPhone,
        AccountStatus.LOCKED,
        dto.reason.trim(),
      );
    } catch {
      this.logger.warn('Could not publish encrypted SMS notification');
    }

    return this.formatUserDto(updated);
  }

  /**
   * Unlocks a locked resident account.
   */
  async unlockResident(
    residentId: string,
    currentUser: UserDto,
  ): Promise<UserDto> {
    const resident = await this.prisma.account.findUnique({
      where: { id: residentId },
      include: { neighborhood: true },
    });

    if (!resident) {
      throw new AppException(
        'Không tìm thấy thông tin tài khoản.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ACCOUNT_NOT_FOUND,
      );
    }

    if (resident.role !== Role.resident) {
      throw new AppException(
        'Chức năng này chỉ áp dụng cho tài khoản cư dân.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    // Neighborhood isolation for Leader
    if (currentUser.role === UserRole.LEADER) {
      if (resident.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền mở khóa tài khoản thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    if (resident.status !== DbAccountStatus.locked) {
      throw new AppException(
        'Chỉ có thể mở khóa tài khoản cư dân đang bị khóa.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_STATUS_TRANSITION,
      );
    }

    // Update status to ACTIVE
    const updated = await this.prisma.account.update({
      where: { id: residentId },
      data: {
        status: DbAccountStatus.active,
        lockReason: null,
      },
      include: { neighborhood: true },
    });

    return this.formatUserDto(updated);
  }

  /**
   * Creates an active Leader account for a neighborhood (Officer only).
   */
  async createLeader(
    dto: CreateLeaderDto,
    currentUser: UserDto,
  ): Promise<UserDto> {
    if (currentUser.role !== UserRole.OFFICER) {
      throw new AppException(
        'Chỉ Cán bộ phường mới có quyền tạo tài khoản Trưởng khu phố.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const normalizedPhone = normalizePhoneNumber(dto.phoneNumber);
    const phoneHash = this.cryptoService.hashPhone(normalizedPhone);

    // Check if phone already exists
    const existing = await this.prisma.account.findUnique({
      where: { phoneHash },
    });
    if (existing) {
      throw new AppException(
        'Số điện thoại này đã được đăng ký trong hệ thống.',
        HttpStatus.CONFLICT,
        ErrorCode.PHONE_ALREADY_EXISTS,
      );
    }

    // Validate neighborhood exists
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


    const activeLeaders = await this.prisma.account.findMany({
      where: {
        role: Role.leader,
        status: DbAccountStatus.active,
        neighborhoodId: dto.neighborhoodId,
      },
      take: 1,
    });
    if (activeLeaders.length > 0) {
      throw new AppException(
        'Khu phố này đã có một Trưởng khu phố đang hoạt động.',
        HttpStatus.CONFLICT,
        ErrorCode.INVALID_STATUS_TRANSITION,
      );
    }

    // Encrypt phone
    const phoneEncrypted = this.cryptoService.encrypt(normalizedPhone);

    // Create Active Leader account
    let leader: AccountWithNeighborhood;
    try {
      leader = await this.prisma.account.create({
        data: {
          phoneEncrypted,
          phoneHash,
          fullName: dto.fullName.trim(),
          address: dto.address?.trim() || null,
          role: Role.leader,
          status: DbAccountStatus.active,
          neighborhoodId: dto.neighborhoodId,
        },
        include: { neighborhood: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          'Số điện thoại hoặc khu phố đã được gán cho một Trưởng khu phố khác.',
          HttpStatus.CONFLICT,
          ErrorCode.PHONE_ALREADY_EXISTS,
        );
      }
      throw error;
    }

    // Send SMS notification
    try {
      await this.smsPublisherService.publishStatusUpdateSms(
        normalizedPhone,
        AccountStatus.ACTIVE,
        'Tài khoản Trưởng khu phố đã được kích hoạt bởi Cán bộ phường.',
      );
    } catch {
      this.logger.warn('Could not publish encrypted SMS notification');
    }

    return this.formatUserDto(leader);
  }

  /**
   * Bootstraps the initial ward officer account.
   * Concurrency-safe and idempotent for the same officer identity.
   * Refuses if an officer already exists with a different identity, or if the phone
   * is already registered under another role.
   */
  async bootstrapOfficer(
    rawPhone?: string,
    rawFullName?: string,
  ): Promise<UserDto & { isExisting: boolean }> {
    const phoneInput = rawPhone || process.env.BOOTSTRAP_OFFICER_PHONE;
    const fullNameInput = rawFullName || process.env.BOOTSTRAP_OFFICER_FULL_NAME;

    if (!phoneInput || typeof phoneInput !== 'string' || phoneInput.trim().length === 0) {
      throw new AppException(
        'BOOTSTRAP_OFFICER_PHONE is required in the environment',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_PHONE_NUMBER,
      );
    }

    if (!fullNameInput || typeof fullNameInput !== 'string' || fullNameInput.trim().length === 0) {
      throw new AppException(
        'BOOTSTRAP_OFFICER_FULL_NAME is required in the environment',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneInput);
    const trimmedFullName = fullNameInput.trim();
    const phoneHash = this.cryptoService.hashPhone(normalizedPhone);
    const phoneEncrypted = this.cryptoService.encrypt(normalizedPhone);

    const MAX_RETRIES = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // 1. Check for existing officer accounts
            const existingOfficers = await tx.account.findMany({
              where: { role: Role.officer },
              include: { neighborhood: true },
            });

            if (existingOfficers.length > 0) {
              // Check if identical identity (same phoneHash and full name)
              const matched = existingOfficers.find(
                (off) =>
                  off.phoneHash === phoneHash &&
                  off.fullName.trim() === trimmedFullName,
              );

              if (matched && existingOfficers.length === 1) {
                this.logger.log(
                  `Officer already bootstrapped with matching identity (ID: ${matched.id})`,
                );
                return {
                  ...this.formatUserDto(matched),
                  isExisting: true,
                };
              }

              throw new AppException(
                'An officer already exists in the system with a different identity. Bootstrap is permitted only once for the initial officer.',
                HttpStatus.CONFLICT,
                ErrorCode.FORBIDDEN,
              );
            }

            // 2. Check if phone is already registered under another role
            const phoneOwner = await tx.account.findUnique({
              where: { phoneHash },
            });

            if (phoneOwner) {
              throw new AppException(
                `Phone number is already registered under another role (${phoneOwner.role}). Cannot bootstrap officer with this phone.`,
                HttpStatus.CONFLICT,
                ErrorCode.PHONE_ALREADY_EXISTS,
              );
            }

            // 3. Create the initial active officer
            const created = await tx.account.create({
              data: {
                phoneEncrypted,
                phoneHash,
                fullName: trimmedFullName,
                role: Role.officer,
                status: DbAccountStatus.active,
                neighborhoodId: null,
              },
              include: { neighborhood: true },
            });

            this.logger.log(
              `Initial officer bootstrapped successfully (ID: ${created.id}, Role: ${created.role})`,
            );

            return {
              ...this.formatUserDto(created),
              isExisting: false,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (err) {
        if (err instanceof AppException) {
          throw err;
        }

        const isSerializationConflict =
          (err instanceof Prisma.PrismaClientKnownRequestError &&
            (err.code === 'P2034' || err.code === 'P2002')) ||
          (err instanceof Error &&
            err.message.toLowerCase().includes('serialization'));

        if (isSerializationConflict && attempt < MAX_RETRIES) {
          this.logger.warn(
            `Serializable conflict during officer bootstrap; retrying attempt ${attempt + 1}...`,
          );
          await new Promise((r) => setTimeout(r, 50 * attempt));
          continue;
        }

        lastError = err;
        break;
      }
    }

    throw lastError;
  }
}
