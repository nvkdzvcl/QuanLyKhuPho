import { HttpStatus } from '@nestjs/common';
import {
  Gender as DbGender,
  HighestEducation as DbHighestEducation,
  PartyStatus as DbPartyStatus,
  Prisma,
} from '@prisma/client';
import {
  ErrorCode,
  HighestEducation,
  ResidentProfileFilterQueryDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { CryptoService } from '../security/crypto.service';

export const EDUCATION_ORDER: HighestEducation[] = [
  HighestEducation.LOWER_SECONDARY,
  HighestEducation.UPPER_SECONDARY,
  HighestEducation.VOCATIONAL,
  HighestEducation.COLLEGE,
  HighestEducation.BACHELOR,
  HighestEducation.MASTER,
  HighestEducation.DOCTORATE,
];

/**
 * Returns all education levels that satisfy or exceed the given minimum level.
 */
export function getAllowedEducationLevels(
  minEducation: HighestEducation,
): HighestEducation[] {
  const index = EDUCATION_ORDER.indexOf(minEducation);
  if (index === -1) {
    return [minEducation];
  }
  return EDUCATION_ORDER.slice(index);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Computes exact UTC calendar birth date cutoff boundaries for age filtering.
 * Calendar age on referenceDate:
 * - ageFrom: birthDate <= maxBirthDate (turned ageFrom on or before referenceDate)
 * - ageTo: birthDate > minBirthDateExcl (has not yet turned ageTo + 1)
 */
export function getBirthDateCutoffs(
  referenceDate: Date,
  ageFrom?: number,
  ageTo?: number,
): {
  minBirthDateExcl?: Date;
  maxBirthDate?: Date;
} {
  if (ageFrom !== undefined) {
    if (isNaN(ageFrom) || ageFrom < 0 || ageFrom > 150) {
      throw new AppException(
        'Độ tuổi bắt đầu phải là số nguyên từ 0 đến 150.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }
  }

  if (ageTo !== undefined) {
    if (isNaN(ageTo) || ageTo < 0 || ageTo > 150) {
      throw new AppException(
        'Độ tuổi kết thúc phải là số nguyên từ 0 đến 150.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }
  }

  if (ageFrom !== undefined && ageTo !== undefined && ageFrom > ageTo) {
    throw new AppException(
      'Độ tuổi bắt đầu (ageFrom) không được lớn hơn độ tuổi kết thúc (ageTo).',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDay = referenceDate.getUTCDate();

  let maxBirthDate: Date | undefined;
  if (ageFrom !== undefined) {
    const maxYear = refYear - ageFrom;
    const maxDay = Math.min(refDay, getDaysInMonth(maxYear, refMonth));
    maxBirthDate = new Date(Date.UTC(maxYear, refMonth, maxDay, 23, 59, 59, 999));
  }

  let minBirthDateExcl: Date | undefined;
  if (ageTo !== undefined) {
    const minYear = refYear - ageTo - 1;
    const minDay = Math.min(refDay, getDaysInMonth(minYear, refMonth));
    minBirthDateExcl = new Date(Date.UTC(minYear, refMonth, minDay, 23, 59, 59, 999));
  }

  return {
    minBirthDateExcl,
    maxBirthDate,
  };
}

/**
 * Builds a secure Prisma ResidentProfileWhereInput object combining all advanced filter criteria with AND.
 * Enforces role and neighborhood scoping server-side.
 */
export function buildResidentWhereInput(
  currentUser: UserDto,
  query: ResidentProfileFilterQueryDto,
  cryptoService: CryptoService,
  referenceDate: Date = new Date(),
): Prisma.ResidentProfileWhereInput {
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

  // 1. Scoping
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
    if (query.neighborhoodId && query.neighborhoodId.trim()) {
      where.neighborhoodId = query.neighborhoodId.trim();
    }
  }

  // 2. Gender filter
  if (query.gender) {
    where.gender = query.gender as unknown as DbGender;
  }

  // 3. Age bounds
  if (query.ageFrom !== undefined || query.ageTo !== undefined) {
    const { minBirthDateExcl, maxBirthDate } = getBirthDateCutoffs(
      referenceDate,
      query.ageFrom !== undefined ? Number(query.ageFrom) : undefined,
      query.ageTo !== undefined ? Number(query.ageTo) : undefined,
    );

    const birthDateFilter: Prisma.DateTimeFilter = {};
    if (maxBirthDate) {
      birthDateFilter.lte = maxBirthDate;
    }
    if (minBirthDateExcl) {
      birthDateFilter.gt = minBirthDateExcl;
    }
    where.birthDate = birthDateFilter;
  }

  // 4. Relationship to household head (trimmed, case-insensitive)
  if (query.relationshipToHead && query.relationshipToHead.trim()) {
    where.relationshipToHead = {
      contains: query.relationshipToHead.trim(),
      mode: 'insensitive',
    };
  }

  // 5. Occupation (trimmed, case-insensitive)
  if (query.occupation && query.occupation.trim()) {
    where.occupation = {
      contains: query.occupation.trim(),
      mode: 'insensitive',
    };
  }

  // 6. Ward (trimmed, case-insensitive)
  if (query.ward && query.ward.trim()) {
    where.ward = {
      contains: query.ward.trim(),
      mode: 'insensitive',
    };
  }

  // 7. Political-Social filters (Party status and Min Education)
  const hasPartyStatus = Boolean(query.partyStatus);
  const hasMinEducation = Boolean(query.minEducation);

  if (hasPartyStatus || hasMinEducation) {
    if (query.partyStatus === 'not_updated') {
      if (hasMinEducation) {
        // Resident without political profile cannot have highestEducation
        where.AND = [
          { politicalSocialProfile: null },
          { id: '__impossible_match__' },
        ];
      } else {
        where.politicalSocialProfile = null;
      }
    } else {
      const polFilter: Prisma.PoliticalSocialProfileWhereInput = {};
      if (query.partyStatus) {
        polFilter.partyStatus = query.partyStatus as unknown as DbPartyStatus;
      }
      if (query.minEducation) {
        const allowed = getAllowedEducationLevels(query.minEducation);
        polFilter.highestEducation = {
          in: allowed as unknown as DbHighestEducation[],
        };
      }
      where.politicalSocialProfile = polFilter;
    }
  }

  // 8. Search filter (OR internally across name, household code, citizenIdHash)
  if (query.search && query.search.trim().length > 0) {
    const trimmedSearch = query.search.trim();
    const isExactCid = /^\d{12}$/.test(trimmedSearch.replace(/[\s-]/g, ''));

    if (isExactCid) {
      const cleanedCid = trimmedSearch.replace(/[\s-]/g, '');
      const searchHash = cryptoService.hashCitizenId(cleanedCid);
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

  return where;
}
