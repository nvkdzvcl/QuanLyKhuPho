import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Gender as DbGender,
  Household,
  Neighborhood,
  Prisma,
  ResidentProfile,
} from '@prisma/client';
import {
  CreateResidentProfileDto,
  ErrorCode,
  Gender,
  HouseholdDto,
  ResidentProfileDetailDto,
  ResidentProfileDto,
  ResidentProfileFilterQueryDto,
  ResidentProfileListResponseDto,
  UpdateResidentProfileDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../security/crypto.service';
import {
  maskCitizenId,
  maskEmail,
  normalizeCitizenId,
} from '../security/citizen-id-utils';
import { maskPhoneNumber, normalizePhoneNumber } from '../security/phone-utils';

type FullResidentProfile = ResidentProfile & {
  household: Household | null;
  neighborhood: Neighborhood | null;
};

@Injectable()
export class ResidentProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Helper to format a database Household into HouseholdDto.
   */
  private formatHouseholdDto(household: Household): HouseholdDto {
    return {
      id: household.id,
      code: household.code,
      neighborhoodId: household.neighborhoodId,
      address: household.address,
      createdAt: household.createdAt.toISOString(),
      updatedAt: household.updatedAt.toISOString(),
    };
  }

  /**
   * Helper to format a database ResidentProfile into a safe ResidentProfileDto (List view).
   * Masks citizen ID, phone, and email. Never exposes ciphertext or hashes.
   */
  private formatProfileDto(profile: FullResidentProfile): ResidentProfileDto {
    let maskedCid = '***';
    try {
      if (profile.citizenIdEncrypted) {
        const decrypted = this.cryptoService.decrypt(profile.citizenIdEncrypted);
        maskedCid = maskCitizenId(decrypted);
      }
    } catch {
      maskedCid = '***';
    }

    let maskedPhone: string | null = null;
    try {
      if (profile.phoneEncrypted) {
        const decrypted = this.cryptoService.decrypt(profile.phoneEncrypted);
        maskedPhone = maskPhoneNumber(decrypted);
      }
    } catch {
      maskedPhone = '***';
    }

    let maskedEm: string | null = null;
    try {
      if (profile.emailEncrypted) {
        const decrypted = this.cryptoService.decrypt(profile.emailEncrypted);
        maskedEm = maskEmail(decrypted);
      }
    } catch {
      maskedEm = '***';
    }

    return {
      id: profile.id,
      fullName: profile.fullName,
      maskedCitizenId: maskedCid,
      citizenIdIssueDate: profile.citizenIdIssueDate
        ? profile.citizenIdIssueDate.toISOString()
        : null,
      birthDate: profile.birthDate.toISOString(),
      gender: (profile.gender as unknown as Gender) || Gender.OTHER,
      placeOfBirth: profile.placeOfBirth,
      relationshipToHead: profile.relationshipToHead,
      maskedPhone,
      maskedEmail: maskedEm,
      occupation: profile.occupation,
      permanentAddress: profile.permanentAddress,
      currentAddress: profile.currentAddress,
      ward: profile.ward,
      city: profile.city,
      householdId: profile.householdId,
      household: profile.household ? this.formatHouseholdDto(profile.household) : null,
      neighborhoodId: profile.neighborhoodId,
      neighborhood: profile.neighborhood
        ? {
            id: profile.neighborhood.id,
            code: profile.neighborhood.code,
            name: profile.neighborhood.name,
            ward: profile.neighborhood.ward,
            district: profile.neighborhood.district,
            city: profile.neighborhood.city,
            description: profile.neighborhood.description,
            createdAt: profile.neighborhood.createdAt.toISOString(),
            updatedAt: profile.neighborhood.updatedAt.toISOString(),
          }
        : null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  /**
   * Helper to format a database ResidentProfile into a ResidentProfileDetailDto (Detail & Edit view).
   * Includes decrypted citizen ID and contact details for authorized editing.
   */
  private formatDetailDto(profile: FullResidentProfile): ResidentProfileDetailDto {
    const base = this.formatProfileDto(profile);

    let decryptedCitizenId = '';
    try {
      decryptedCitizenId = this.cryptoService.decrypt(profile.citizenIdEncrypted);
    } catch {
      decryptedCitizenId = '';
    }

    let decryptedPhone: string | null = null;
    try {
      if (profile.phoneEncrypted) {
        decryptedPhone = this.cryptoService.decrypt(profile.phoneEncrypted);
      }
    } catch {
      decryptedPhone = null;
    }

    let decryptedEmail: string | null = null;
    try {
      if (profile.emailEncrypted) {
        decryptedEmail = this.cryptoService.decrypt(profile.emailEncrypted);
      }
    } catch {
      decryptedEmail = null;
    }

    return {
      ...base,
      citizenId: decryptedCitizenId,
      phoneNumber: decryptedPhone,
      email: decryptedEmail,
    };
  }

  /**
   * Validates dates (birth date not future, issue date not future, issue date >= birth date).
   */
  private validateDates(birthDateStr: string, issueDateStr?: string | null): {
    birthDate: Date;
    issueDate: Date | null;
  } {
    const birthDate = new Date(birthDateStr);
    if (isNaN(birthDate.getTime())) {
      throw new AppException(
        'Ngày sinh không đúng định dạng ngày tháng hợp lệ.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const now = new Date();
    if (birthDate > now) {
      throw new AppException(
        'Ngày sinh không được ở tương lai.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    let issueDate: Date | null = null;
    if (issueDateStr) {
      issueDate = new Date(issueDateStr);
      if (isNaN(issueDate.getTime())) {
        throw new AppException(
          'Ngày cấp CCCD không đúng định dạng ngày tháng hợp lệ.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      if (issueDate > now) {
        throw new AppException(
          'Ngày cấp CCCD không được ở tương lai.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      if (issueDate < birthDate) {
        throw new AppException(
          'Ngày cấp CCCD không được trước ngày sinh.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    return { birthDate, issueDate };
  }

  /**
   * Creates a new resident profile.
   * Leaders can only create within their assigned neighborhood.
   * Officers can create for any specified neighborhood.
   */
  async create(
    currentUser: UserDto,
    dto: CreateResidentProfileDto,
  ): Promise<ResidentProfileDetailDto> {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố và Cán bộ phường mới có quyền thêm hồ sơ nhân khẩu.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    // Determine target neighborhood
    let targetNeighborhoodId: string;
    if (currentUser.role === UserRole.LEADER) {
      if (!currentUser.neighborhoodId) {
        throw new AppException(
          'Trưởng khu phố chưa được gán vào khu phố nào.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
      targetNeighborhoodId = currentUser.neighborhoodId;
    } else {
      if (!dto.neighborhoodId) {
        throw new AppException(
          'Vui lòng chọn khu phố cho nhân khẩu.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      targetNeighborhoodId = dto.neighborhoodId;
    }

    // Validate neighborhood exists
    const neighborhood = await this.prisma.neighborhood.findUnique({
      where: { id: targetNeighborhoodId },
    });
    if (!neighborhood) {
      throw new AppException(
        'Khu phố được chọn không tồn tại trong hệ thống.',
        HttpStatus.NOT_FOUND,
        ErrorCode.NEIGHBORHOOD_NOT_FOUND,
      );
    }

    // Validate citizen ID
    const normalizedCitizenId = normalizeCitizenId(dto.citizenId);
    const citizenIdHash = this.cryptoService.hashCitizenId(normalizedCitizenId);
    const citizenIdEncrypted = this.cryptoService.encrypt(normalizedCitizenId);

    // Validate dates
    const { birthDate, issueDate } = this.validateDates(
      dto.birthDate,
      dto.citizenIdIssueDate,
    );

    // Encrypt contact info if provided
    let phoneEncrypted: string | null = null;
    if (dto.phoneNumber && dto.phoneNumber.trim().length > 0) {
      const normalizedPhone = normalizePhoneNumber(dto.phoneNumber);
      phoneEncrypted = this.cryptoService.encrypt(normalizedPhone);
    }

    let emailEncrypted: string | null = null;
    if (dto.email && dto.email.trim().length > 0) {
      emailEncrypted = this.cryptoService.encrypt(dto.email.trim().toLowerCase());
    }

    const trimmedFullName = dto.fullName.trim();
    const trimmedHouseholdCode = dto.householdCode.trim();
    const trimmedPermanentAddress = dto.permanentAddress.trim();

    try {
      const createdProfile = await this.prisma.$transaction(
        async (tx) => {
          // Check for existing citizen ID
          const existing = await tx.residentProfile.findUnique({
            where: { citizenIdHash },
          });
          if (existing) {
            throw new AppException(
              'Số Căn cước công dân này đã tồn tại trong hệ thống.',
              HttpStatus.CONFLICT,
              ErrorCode.CITIZEN_ID_ALREADY_EXISTS,
            );
          }

          // Atomically reuse or create the household to avoid races when two
          // profiles with the same household code are submitted concurrently.
          const household = await tx.household.upsert({
            where: {
              neighborhoodId_code: {
                neighborhoodId: targetNeighborhoodId,
                code: trimmedHouseholdCode,
              },
            },
            update: {},
            create: {
              code: trimmedHouseholdCode,
              neighborhoodId: targetNeighborhoodId,
              address: trimmedPermanentAddress,
            },
          });

          // Create Resident Profile
          const profile = await tx.residentProfile.create({
            data: {
              fullName: trimmedFullName,
              citizenIdEncrypted,
              citizenIdHash,
              citizenIdIssueDate: issueDate,
              birthDate,
              gender: (dto.gender as unknown as DbGender) || DbGender.other,
              placeOfBirth: dto.placeOfBirth?.trim() || null,
              relationshipToHead: dto.relationshipToHead?.trim() || null,
              phoneEncrypted,
              emailEncrypted,
              occupation: dto.occupation?.trim() || null,
              permanentAddress: trimmedPermanentAddress,
              currentAddress: dto.currentAddress?.trim() || null,
              ward: dto.ward?.trim() || neighborhood.ward,
              city: dto.city?.trim() || neighborhood.city,
              householdId: household.id,
              neighborhoodId: targetNeighborhoodId,
            },
            include: {
              household: true,
              neighborhood: true,
            },
          });

          return profile;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return this.formatDetailDto(createdProfile);
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          'Số Căn cước công dân này đã tồn tại trong hệ thống.',
          HttpStatus.CONFLICT,
          ErrorCode.CITIZEN_ID_ALREADY_EXISTS,
        );
      }
      throw error;
    }
  }

  /**
   * Paginated list and search for resident profiles.
   * Leaders are scoped strictly to their assigned neighborhood.
   * Officers can view ward-wide or filter by neighborhood.
   * Returns masked citizen IDs.
   */
  async findAll(
    currentUser: UserDto,
    query: ResidentProfileFilterQueryDto,
  ): Promise<ResidentProfileListResponseDto> {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố và Cán bộ phường mới có quyền truy cập thông tin nhân khẩu.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const where: Prisma.ResidentProfileWhereInput = {};

    // Scoping
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
      if (query.neighborhoodId) {
        where.neighborhoodId = query.neighborhoodId;
      }
    }

    // Gender filter
    if (query.gender) {
      where.gender = query.gender as unknown as DbGender;
    }

    // Search filter: fullName, household code, or exact 12-digit citizen ID
    if (query.search && query.search.trim().length > 0) {
      const trimmedSearch = query.search.trim();
      const isExactCid = /^\d{12}$/.test(trimmedSearch.replace(/[\s-]/g, ''));

      if (isExactCid) {
        const cleanedCid = trimmedSearch.replace(/[\s-]/g, '');
        const searchHash = this.cryptoService.hashCitizenId(cleanedCid);
        where.OR = [
          { citizenIdHash: searchHash },
          { fullName: { contains: trimmedSearch, mode: 'insensitive' } },
          { household: { code: { contains: trimmedSearch, mode: 'insensitive' } } },
        ];
      } else {
        where.OR = [
          { fullName: { contains: trimmedSearch, mode: 'insensitive' } },
          { household: { code: { contains: trimmedSearch, mode: 'insensitive' } } },
        ];
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [total, profiles] = await Promise.all([
      this.prisma.residentProfile.count({ where }),
      this.prisma.residentProfile.findMany({
        where,
        include: {
          household: true,
          neighborhood: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: profiles.map((p) => this.formatProfileDto(p)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Detail view of a resident profile.
   * Leaders can only view profiles in their own neighborhood.
   * Returns decrypted citizen ID and contact info for authorized viewing/editing.
   */
  async findOne(
    currentUser: UserDto,
    id: string,
  ): Promise<ResidentProfileDetailDto> {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố và Cán bộ phường mới có quyền xem thông tin nhân khẩu.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const profile = await this.prisma.residentProfile.findUnique({
      where: { id },
      include: {
        household: true,
        neighborhood: true,
      },
    });

    if (!profile) {
      throw new AppException(
        'Không tìm thấy hồ sơ nhân khẩu.',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESIDENT_PROFILE_NOT_FOUND,
      );
    }

    // Scoping for Leader
    if (currentUser.role === UserRole.LEADER) {
      if (profile.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền truy cập hồ sơ nhân khẩu thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    return this.formatDetailDto(profile);
  }

  /**
   * Updates an existing resident profile.
   * Leaders can only update profiles in their own neighborhood.
   */
  async update(
    currentUser: UserDto,
    id: string,
    dto: UpdateResidentProfileDto,
  ): Promise<ResidentProfileDetailDto> {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố và Cán bộ phường mới có quyền cập nhật thông tin nhân khẩu.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const existingProfile = await this.prisma.residentProfile.findUnique({
      where: { id },
      include: {
        household: true,
        neighborhood: true,
      },
    });

    if (!existingProfile) {
      throw new AppException(
        'Không tìm thấy hồ sơ nhân khẩu.',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESIDENT_PROFILE_NOT_FOUND,
      );
    }

    // Scoping for Leader
    if (currentUser.role === UserRole.LEADER) {
      if (existingProfile.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền chỉnh sửa hồ sơ nhân khẩu thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    // Determine target neighborhood
    let targetNeighborhoodId = existingProfile.neighborhoodId;
    if (currentUser.role === UserRole.OFFICER && dto.neighborhoodId) {
      const targetNeighborhood = await this.prisma.neighborhood.findUnique({
        where: { id: dto.neighborhoodId },
      });
      if (!targetNeighborhood) {
        throw new AppException(
          'Khu phố được chọn không tồn tại trong hệ thống.',
          HttpStatus.NOT_FOUND,
          ErrorCode.NEIGHBORHOOD_NOT_FOUND,
        );
      }
      targetNeighborhoodId = dto.neighborhoodId;
    }

    // Handle citizen ID change
    let citizenIdEncrypted = existingProfile.citizenIdEncrypted;
    let citizenIdHash = existingProfile.citizenIdHash;

    if (dto.citizenId && dto.citizenId.trim().length > 0) {
      const normalizedCitizenId = normalizeCitizenId(dto.citizenId);
      citizenIdHash = this.cryptoService.hashCitizenId(normalizedCitizenId);
      citizenIdEncrypted = this.cryptoService.encrypt(normalizedCitizenId);
    }

    // Handle date validations
    const birthDateStr = dto.birthDate || existingProfile.birthDate.toISOString();
    const issueDateStr =
      dto.citizenIdIssueDate !== undefined
        ? dto.citizenIdIssueDate
        : existingProfile.citizenIdIssueDate?.toISOString();

    const { birthDate, issueDate } = this.validateDates(birthDateStr, issueDateStr);

    // Handle contact encryption
    let phoneEncrypted = existingProfile.phoneEncrypted;
    if (dto.phoneNumber !== undefined) {
      if (dto.phoneNumber && dto.phoneNumber.trim().length > 0) {
        const normalizedPhone = normalizePhoneNumber(dto.phoneNumber);
        phoneEncrypted = this.cryptoService.encrypt(normalizedPhone);
      } else {
        phoneEncrypted = null;
      }
    }

    let emailEncrypted = existingProfile.emailEncrypted;
    if (dto.email !== undefined) {
      if (dto.email && dto.email.trim().length > 0) {
        emailEncrypted = this.cryptoService.encrypt(dto.email.trim().toLowerCase());
      } else {
        emailEncrypted = null;
      }
    }

    const permanentAddress =
      dto.permanentAddress !== undefined
        ? dto.permanentAddress.trim()
        : existingProfile.permanentAddress;

    const householdCode =
      dto.householdCode !== undefined
        ? dto.householdCode.trim()
        : existingProfile.household?.code || '';

    try {
      const updatedProfile = await this.prisma.$transaction(
        async (tx) => {
          // Check for citizen ID collision with another profile
          if (citizenIdHash !== existingProfile.citizenIdHash) {
            const conflict = await tx.residentProfile.findUnique({
              where: { citizenIdHash },
            });
            if (conflict && conflict.id !== id) {
              throw new AppException(
                'Số Căn cước công dân này đã tồn tại trong hệ thống.',
                HttpStatus.CONFLICT,
                ErrorCode.CITIZEN_ID_ALREADY_EXISTS,
              );
            }
          }

          // Handle household
          let householdId = existingProfile.householdId;
          if (
            householdCode !== existingProfile.household?.code ||
            targetNeighborhoodId !== existingProfile.neighborhoodId
          ) {
            const household = await tx.household.upsert({
              where: {
                neighborhoodId_code: {
                  neighborhoodId: targetNeighborhoodId,
                  code: householdCode,
                },
              },
              update: {},
              create: {
                code: householdCode,
                neighborhoodId: targetNeighborhoodId,
                address: permanentAddress,
              },
            });
            householdId = household.id;
          }

          const updated = await tx.residentProfile.update({
            where: { id },
            data: {
              fullName: dto.fullName !== undefined ? dto.fullName.trim() : undefined,
              citizenIdEncrypted,
              citizenIdHash,
              citizenIdIssueDate: issueDate,
              birthDate,
              gender:
                dto.gender !== undefined
                  ? (dto.gender as unknown as DbGender)
                  : undefined,
              placeOfBirth:
                dto.placeOfBirth !== undefined
                  ? dto.placeOfBirth?.trim() || null
                  : undefined,
              relationshipToHead:
                dto.relationshipToHead !== undefined
                  ? dto.relationshipToHead?.trim() || null
                  : undefined,
              phoneEncrypted,
              emailEncrypted,
              occupation:
                dto.occupation !== undefined
                  ? dto.occupation?.trim() || null
                  : undefined,
              permanentAddress,
              currentAddress:
                dto.currentAddress !== undefined
                  ? dto.currentAddress?.trim() || null
                  : undefined,
              ward: dto.ward !== undefined ? dto.ward?.trim() || null : undefined,
              city: dto.city !== undefined ? dto.city?.trim() || null : undefined,
              householdId,
              neighborhoodId: targetNeighborhoodId,
            },
            include: {
              household: true,
              neighborhood: true,
            },
          });

          return updated;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return this.formatDetailDto(updatedProfile);
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          'Số Căn cước công dân này đã tồn tại trong hệ thống.',
          HttpStatus.CONFLICT,
          ErrorCode.CITIZEN_ID_ALREADY_EXISTS,
        );
      }
      throw error;
    }
  }
}
