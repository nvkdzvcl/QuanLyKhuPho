import { HttpStatus, Injectable } from '@nestjs/common';
import {
  HighestEducation as DbHighestEducation,
  Household,
  Neighborhood,
  PartyStatus as DbPartyStatus,
  PoliticalSocialProfile,
  Prisma,
  ResidentProfile,
} from '@prisma/client';
import {
  ErrorCode,
  Gender,
  HighestEducation,
  PartyStatus,
  PoliticalSocialProfileDto,
  PoliticalSocialProfileListResponseDto,
  ResidentPoliticalSocialItemDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { PoliticalSocialQueryDto } from './dto/political-social-query.dto';
import { UpsertPoliticalSocialProfileDto } from './dto/upsert-political-social-profile.dto';

type FullResidentWithPolitical = ResidentProfile & {
  household: Household | null;
  neighborhood: Neighborhood | null;
  politicalSocialProfile: PoliticalSocialProfile | null;
};

@Injectable()
export class PoliticalSocialProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Formats a database PoliticalSocialProfile entity into a PoliticalSocialProfileDto.
   */
  private formatProfileDto(
    profile: PoliticalSocialProfile,
  ): PoliticalSocialProfileDto {
    return {
      id: profile.id,
      residentProfileId: profile.residentProfileId,
      partyStatus: profile.partyStatus as unknown as PartyStatus,
      partyAdmissionDate: profile.partyAdmissionDate
        ? profile.partyAdmissionDate.toISOString()
        : null,
      highestEducation:
        (profile.highestEducation as unknown as HighestEducation) || null,
      specialty: profile.specialty,
      officialOccupation: profile.officialOccupation,
      strengths: profile.strengths,
      notes: profile.notes,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  /**
   * Formats a resident entity into a ResidentPoliticalSocialItemDto.
   * Personal identifiers (citizen ID, phone, email) are omitted to protect privacy.
   */
  private formatResidentItemDto(
    resident: FullResidentWithPolitical,
  ): ResidentPoliticalSocialItemDto {
    return {
      id: resident.id,
      fullName: resident.fullName,
      birthDate: resident.birthDate.toISOString(),
      gender: (resident.gender as unknown as Gender) || Gender.OTHER,
      permanentAddress: resident.permanentAddress,
      householdCode: resident.household?.code || null,
      neighborhoodId: resident.neighborhoodId,
      neighborhoodName: resident.neighborhood?.name || null,
      politicalSocialProfile: resident.politicalSocialProfile
        ? this.formatProfileDto(resident.politicalSocialProfile)
        : null,
      createdAt: resident.createdAt.toISOString(),
      updatedAt: resident.updatedAt.toISOString(),
    };
  }

  /**
   * Paginated list and search of residents with their political/social information.
   * Leaders are scoped strictly to their assigned neighborhood.
   * Officers can view ward-wide or filter by neighborhood.
   */
  async findAll(
    currentUser: UserDto,
    query: PoliticalSocialQueryDto,
  ): Promise<PoliticalSocialProfileListResponseDto> {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố và Cán bộ phường mới có quyền truy cập thông tin chính trị - xã hội.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const where: Prisma.ResidentProfileWhereInput = {};

    // Neighborhood scoping
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

    // Party status filter
    if (query.partyStatus) {
      if (query.partyStatus === 'not_updated') {
        where.politicalSocialProfile = null;
      } else if (
        Object.values(PartyStatus).includes(query.partyStatus as PartyStatus)
      ) {
        where.politicalSocialProfile = {
          partyStatus: query.partyStatus as unknown as DbPartyStatus,
        };
      }
    }

    // Search filter (name or household code only)
    if (query.search && query.search.trim().length > 0) {
      const trimmedSearch = query.search.trim();
      where.OR = [
        { fullName: { contains: trimmedSearch, mode: 'insensitive' } },
        {
          household: {
            code: { contains: trimmedSearch, mode: 'insensitive' },
          },
        },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [total, residents] = await Promise.all([
      this.prisma.residentProfile.count({ where }),
      this.prisma.residentProfile.findMany({
        where,
        include: {
          household: true,
          neighborhood: true,
          politicalSocialProfile: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: (residents as FullResidentWithPolitical[]).map((r) =>
        this.formatResidentItemDto(r),
      ),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves a single resident's political/social record.
   */
  async findOne(
    currentUser: UserDto,
    residentProfileId: string,
  ): Promise<ResidentPoliticalSocialItemDto> {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố và Cán bộ phường mới có quyền truy cập thông tin chính trị - xã hội.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    const resident = await this.prisma.residentProfile.findUnique({
      where: { id: residentProfileId },
      include: {
        household: true,
        neighborhood: true,
        politicalSocialProfile: true,
      },
    });

    if (!resident) {
      throw new AppException(
        'Không tìm thấy hồ sơ nhân khẩu.',
        HttpStatus.NOT_FOUND,
        ErrorCode.RESIDENT_PROFILE_NOT_FOUND,
      );
    }

    // Scoping for Leader
    if (currentUser.role === UserRole.LEADER) {
      if (resident.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền truy cập thông tin chính trị - xã hội của nhân khẩu thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    return this.formatResidentItemDto(resident as FullResidentWithPolitical);
  }

  /**
   * Upserts the political/social profile for a scoped resident.
   * Validates party status and conditional/non-future admission date.
   */
  async upsert(
    currentUser: UserDto,
    residentProfileId: string,
    dto: UpsertPoliticalSocialProfileDto,
  ): Promise<PoliticalSocialProfileDto> {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố và Cán bộ phường mới có quyền cập nhật thông tin chính trị - xã hội.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }

    // 1. Validate party status and conditional admission date
    if (!Object.values(PartyStatus).includes(dto.partyStatus)) {
      throw new AppException(
        'Tình trạng Đảng không hợp lệ.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    let admissionDate: Date | null = null;

    if (dto.partyStatus === PartyStatus.PARTY_MEMBER) {
      if (!dto.partyAdmissionDate || !dto.partyAdmissionDate.trim()) {
        throw new AppException(
          'Ngày vào Đảng là bắt buộc đối với Đảng viên.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      admissionDate = new Date(dto.partyAdmissionDate);
      if (isNaN(admissionDate.getTime())) {
        throw new AppException(
          'Ngày vào Đảng không đúng định dạng ngày tháng hợp lệ.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const now = new Date();
      if (admissionDate > now) {
        throw new AppException(
          'Ngày vào Đảng không được ở tương lai.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }

    } else {
      // For non-party members, ensure party admission date is stored as null
      admissionDate = null;
    }

    // 2. Validate highest education if provided
    if (
      dto.highestEducation &&
      !Object.values(HighestEducation).includes(dto.highestEducation)
    ) {
      throw new AppException(
        'Trình độ học vấn không hợp lệ.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 3. Validate string field lengths
    if (dto.specialty && dto.specialty.trim().length > 255) {
      throw new AppException(
        'Chuyên môn / Chuyên ngành tối đa 255 ký tự.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (
      dto.officialOccupation &&
      dto.officialOccupation.trim().length > 255
    ) {
      throw new AppException(
        'Nghề nghiệp / Vị trí công tác tối đa 255 ký tự.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (dto.strengths && dto.strengths.trim().length > 1000) {
      throw new AppException(
        'Sở trường / Kỹ năng nổi bật tối đa 1000 ký tự.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (dto.notes && dto.notes.trim().length > 4000) {
      throw new AppException(
        'Ghi chú tối đa 4000 ký tự.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 4. Load, authorize, and upsert in the same serializable transaction so a
    // concurrent neighborhood reassignment cannot bypass leader scoping.
    try {
      const updatedProfile = await this.prisma.$transaction(
        async (tx) => {
          const resident = await tx.residentProfile.findUnique({
            where: { id: residentProfileId },
          });

          if (!resident) {
            throw new AppException(
              'Không tìm thấy hồ sơ nhân khẩu.',
              HttpStatus.NOT_FOUND,
              ErrorCode.RESIDENT_PROFILE_NOT_FOUND,
            );
          }

          if (
            currentUser.role === UserRole.LEADER &&
            resident.neighborhoodId !== currentUser.neighborhoodId
          ) {
            throw new AppException(
              'Bạn không có quyền cập nhật thông tin chính trị - xã hội của nhân khẩu thuộc khu phố khác.',
              HttpStatus.FORBIDDEN,
              ErrorCode.FORBIDDEN,
            );
          }

          if (admissionDate && admissionDate < resident.birthDate) {
            throw new AppException(
              'Ngày vào Đảng không được trước ngày sinh của nhân khẩu.',
              HttpStatus.BAD_REQUEST,
              ErrorCode.VALIDATION_ERROR,
            );
          }

          return tx.politicalSocialProfile.upsert({
            where: { residentProfileId },
            create: {
              residentProfileId,
              partyStatus: dto.partyStatus as unknown as DbPartyStatus,
              partyAdmissionDate: admissionDate,
              highestEducation: dto.highestEducation
                ? (dto.highestEducation as unknown as DbHighestEducation)
                : null,
              specialty: dto.specialty?.trim() || null,
              officialOccupation: dto.officialOccupation?.trim() || null,
              strengths: dto.strengths?.trim() || null,
              notes: dto.notes?.trim() || null,
            },
            update: {
              partyStatus: dto.partyStatus as unknown as DbPartyStatus,
              partyAdmissionDate: admissionDate,
              highestEducation:
                dto.highestEducation !== undefined
                  ? (dto.highestEducation as unknown as DbHighestEducation) ||
                    null
                  : undefined,
              specialty:
                dto.specialty !== undefined
                  ? dto.specialty?.trim() || null
                  : undefined,
              officialOccupation:
                dto.officialOccupation !== undefined
                  ? dto.officialOccupation?.trim() || null
                  : undefined,
              strengths:
                dto.strengths !== undefined
                  ? dto.strengths?.trim() || null
                  : undefined,
              notes:
                dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return this.formatProfileDto(updatedProfile);
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      throw error;
    }
  }
}
