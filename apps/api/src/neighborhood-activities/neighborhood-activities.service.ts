import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Account,
  ActivityFilterCondition as DbActivityFilterCondition,
  ActivityRating as DbActivityRating,
  AttendanceStatus as DbAttendanceStatus,
  Neighborhood,
  NeighborhoodActivity,
  NeighborhoodActivityParticipant,
  PoliticalSocialProfile,
  Prisma,
  ResidentProfile,
} from '@prisma/client';
import {
  ActivityFilterCondition,
  ActivityParticipantDto,
  ActivityRating,
  AttendanceStatus,
  BatchUpdateParticipantsDto,
  CreateNeighborhoodActivityDto,
  CreateNeighborhoodActivityResponseDto,
  ErrorCode,
  NeighborhoodActivityDetailDto,
  NeighborhoodActivityDto,
  NeighborhoodActivityListResponseDto,
  NeighborhoodActivityMonthlyQueryDto,
  PartyStatus,
  UpdateNeighborhoodActivityDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';

type ActivityResidentSummary = Pick<ResidentProfile, 'id' | 'fullName'>;
type ActivityNeighborhoodSummary = Pick<Neighborhood, 'id' | 'name'>;
type ActivityCreatorSummary = Pick<Account, 'id' | 'fullName'>;

export type ParticipantWithResident = NeighborhoodActivityParticipant & {
  residentProfile: ActivityResidentSummary;
};

export type FullActivity = NeighborhoodActivity & {
  neighborhood: ActivityNeighborhoodSummary | null;
  createdBy: ActivityCreatorSummary | null;
  participants: (NeighborhoodActivityParticipant & {
    residentProfile?: ActivityResidentSummary | null;
  })[];
};

export type ResidentWithPolitical = Pick<
  ResidentProfile,
  'id' | 'fullName' | 'birthDate'
> &
  Partial<Omit<ResidentProfile, 'id' | 'fullName' | 'birthDate'>> & {
    politicalSocialProfile:
      | (Pick<PoliticalSocialProfile, 'partyStatus'> &
          Partial<Omit<PoliticalSocialProfile, 'partyStatus'>>)
      | null;
  };

/**
 * Calculates calendar age on the target activity date using UTC date parts.
 * Evaluates integer completed years of age.
 */
export function calculateCalendarAge(birthDate: Date, activityDate: Date): number {
  const bYear = birthDate.getUTCFullYear();
  const bMonth = birthDate.getUTCMonth();
  const bDay = birthDate.getUTCDate();

  const aYear = activityDate.getUTCFullYear();
  const aMonth = activityDate.getUTCMonth();
  const aDay = activityDate.getUTCDate();

  let age = aYear - bYear;
  if (aMonth < bMonth || (aMonth === bMonth && aDay < bDay)) {
    age -= 1;
  }
  return age;
}

@Injectable()
export class NeighborhoodActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to format a participant row with safe resident operational fields.
   * Never exposes sensitive data (citizenId, phone, email, etc.).
   */
  private formatParticipantDto(
    p: ParticipantWithResident,
  ): ActivityParticipantDto {
    return {
      id: p.id,
      activityId: p.activityId,
      residentProfileId: p.residentProfileId,
      fullName: p.residentProfile.fullName,
      attendance: p.attendance as unknown as AttendanceStatus,
      notes: p.notes,
      rating: (p.rating as unknown as ActivityRating) || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /**
   * Helper to format an activity summary with calculated attendance counts.
   */
  private formatActivityDto(a: FullActivity): NeighborhoodActivityDto {
    const participants = a.participants || [];
    const totalParticipants = participants.length;
    const attendedCount = participants.filter(
      (p) => p.attendance === DbAttendanceStatus.attended,
    ).length;
    const absentCount = participants.filter(
      (p) => p.attendance === DbAttendanceStatus.absent,
    ).length;
    const unconfirmedCount = participants.filter(
      (p) => p.attendance === DbAttendanceStatus.unconfirmed,
    ).length;

    return {
      id: a.id,
      neighborhoodId: a.neighborhoodId,
      neighborhoodName: a.neighborhood?.name || null,
      createdById: a.createdById,
      createdByName: a.createdBy?.fullName || null,
      name: a.name,
      activityDate: a.activityDate.toISOString(),
      description: a.description,
      personInCharge: a.personInCharge,
      filterCondition: a.filterCondition as unknown as ActivityFilterCondition,
      totalParticipants,
      attendedCount,
      absentCount,
      unconfirmedCount,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  /**
   * Helper to format an activity detail with full participant roster.
   */
  private formatDetailDto(a: FullActivity): NeighborhoodActivityDetailDto {
    const base = this.formatActivityDto(a);
    const participants = (a.participants || [])
      .filter(
        (
          p,
        ): p is NeighborhoodActivityParticipant & {
          residentProfile: ActivityResidentSummary;
        } => Boolean(p.residentProfile),
      )
      .map((p) => this.formatParticipantDto(p));

    return {
      ...base,
      participants,
    };
  }

  /**
   * Verifies user has Leader or Officer role.
   */
  private checkAuthorizedRole(currentUser: UserDto): void {
    if (
      currentUser.role !== UserRole.LEADER &&
      currentUser.role !== UserRole.OFFICER
    ) {
      throw new AppException(
        'Chỉ Trưởng khu phố và Cán bộ phường mới có quyền sử dụng sổ tay hoạt động khu phố.',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
      );
    }
  }

  /**
   * Creates a new neighborhood activity and freezes its extracted participant roster.
   */
  async create(
    currentUser: UserDto,
    dto: CreateNeighborhoodActivityDto,
  ): Promise<CreateNeighborhoodActivityResponseDto> {
    this.checkAuthorizedRole(currentUser);

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
          'Vui lòng chọn khu phố cho hoạt động.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      targetNeighborhoodId = dto.neighborhoodId;
    }

    // Validate activity date
    const activityDate = new Date(dto.activityDate);
    if (isNaN(activityDate.getTime())) {
      throw new AppException(
        'Ngày diễn ra hoạt động không đúng định dạng ngày tháng hợp lệ.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_ACTIVITY_DATE,
      );
    }

    const trimmedName = dto.name.trim();
    if (trimmedName.length === 0) {
      throw new AppException(
        'Tên hoạt động không được để trống.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    try {
      const { createdActivity, warning, participantCount } =
        await this.prisma.$transaction(
          async (tx) => {
            const neighborhood = await tx.neighborhood.findUnique({
              where: { id: targetNeighborhoodId },
              select: { id: true },
            });
            if (!neighborhood) {
              throw new AppException(
                'Khu phố được chọn không tồn tại trong hệ thống.',
                HttpStatus.NOT_FOUND,
                ErrorCode.NEIGHBORHOOD_NOT_FOUND,
              );
            }

            // Fetch all residents in the target neighborhood with their political profiles
            const residents = await tx.residentProfile.findMany({
              where: { neighborhoodId: targetNeighborhoodId },
              select: {
                id: true,
                fullName: true,
                birthDate: true,
                politicalSocialProfile: {
                  select: { partyStatus: true },
                },
              },
              orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
            });

            // Extract residents based on filterCondition
            let selectedResidents: ResidentWithPolitical[] = [];

            switch (dto.filterCondition) {
              case ActivityFilterCondition.ALL:
                selectedResidents = residents as ResidentWithPolitical[];
                break;

              case ActivityFilterCondition.UNDER_18:
                selectedResidents = (
                  residents as ResidentWithPolitical[]
                ).filter(
                  (r) => calculateCalendarAge(r.birthDate, activityDate) < 18,
                );
                break;

              case ActivityFilterCondition.OVER_18:
                selectedResidents = (
                  residents as ResidentWithPolitical[]
                ).filter(
                  (r) => calculateCalendarAge(r.birthDate, activityDate) > 18,
                );
                break;

              case ActivityFilterCondition.PARTY_MEMBER:
                selectedResidents = (
                  residents as ResidentWithPolitical[]
                ).filter(
                  (r) =>
                    r.politicalSocialProfile?.partyStatus ===
                    PartyStatus.PARTY_MEMBER,
                );
                break;

              case ActivityFilterCondition.CUSTOM: {
                const rawCustomIds = dto.customResidentIds || [];
                const uniqueCustomIds = Array.from(new Set(rawCustomIds));

                if (uniqueCustomIds.length > 0) {
                  const residentMap = new Map(
                    residents.map((r) => [r.id, r as ResidentWithPolitical]),
                  );

                  for (const id of uniqueCustomIds) {
                    const resident = residentMap.get(id);
                    if (!resident) {
                      throw new AppException(
                        'Danh sách nhân khẩu tùy chọn chứa mã không tồn tại hoặc không thuộc khu phố này.',
                        HttpStatus.BAD_REQUEST,
                        ErrorCode.INVALID_PARTICIPANT,
                      );
                    }
                  }

                  selectedResidents = uniqueCustomIds
                    .map((id) => residentMap.get(id)!)
                    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
                } else {
                  selectedResidents = [];
                }
                break;
              }

              default:
                throw new AppException(
                  'Điều kiện lọc danh sách không hợp lệ.',
                  HttpStatus.BAD_REQUEST,
                  ErrorCode.VALIDATION_ERROR,
                );
            }

            // Create activity record
            const activity = await tx.neighborhoodActivity.create({
              data: {
                neighborhoodId: targetNeighborhoodId,
                createdById: currentUser.id,
                name: trimmedName,
                activityDate,
                description: dto.description?.trim() || null,
                personInCharge: dto.personInCharge?.trim() || null,
                filterCondition:
                  dto.filterCondition as unknown as DbActivityFilterCondition,
              },
            });

            // Create frozen participant records
            if (selectedResidents.length > 0) {
              await tx.neighborhoodActivityParticipant.createMany({
                data: selectedResidents.map((r) => ({
                  activityId: activity.id,
                  residentProfileId: r.id,
                  attendance: DbAttendanceStatus.unconfirmed,
                  notes: null,
                  rating: null,
                })),
              });
            }

            const warningMessage =
              selectedResidents.length === 0
                ? 'Không có nhân khẩu nào phù hợp với điều kiện trích xuất danh sách trong khu phố.'
                : null;

            // Fetch full activity with populated participants
            const full = await tx.neighborhoodActivity.findUnique({
              where: { id: activity.id },
              include: {
                neighborhood: { select: { id: true, name: true } },
                createdBy: { select: { id: true, fullName: true } },
                participants: {
                  include: {
                    residentProfile: { select: { id: true, fullName: true } },
                  },
                  orderBy: [
                    { residentProfile: { fullName: 'asc' } },
                    { id: 'asc' },
                  ],
                },
              },
            });

            return {
              createdActivity: full as FullActivity,
              warning: warningMessage,
              participantCount: selectedResidents.length,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );

      return {
        activity: this.formatDetailDto(createdActivity),
        warning,
        participantCount,
      };
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Monthly paginated lookup for activities.
   * Uses activityDate as source of truth.
   * Leaders are scoped strictly to their assigned neighborhood.
   * Officers can view ward-wide or filter by neighborhood.
   */
  async findAllMonthly(
    currentUser: UserDto,
    query: NeighborhoodActivityMonthlyQueryDto,
  ): Promise<NeighborhoodActivityListResponseDto> {
    this.checkAuthorizedRole(currentUser);

    const monthStr = query.month;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr)) {
      throw new AppException(
        'Tháng tra cứu phải có định dạng YYYY-MM (Ví dụ: 2026-08).',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const [yearPart, monthPart] = monthStr.split('-');
    const year = parseInt(yearPart!, 10);
    const month = parseInt(monthPart!, 10);

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const where: Prisma.NeighborhoodActivityWhereInput = {
      activityDate: {
        gte: startDate,
        lt: endDate,
      },
    };

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

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [total, activities] = await Promise.all([
      this.prisma.neighborhoodActivity.count({ where }),
      this.prisma.neighborhoodActivity.findMany({
        where,
        include: {
          neighborhood: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
          participants: {
            select: {
              id: true,
              attendance: true,
            },
          },
        },
        orderBy: [
          { activityDate: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: activities.map((a) => this.formatActivityDto(a as FullActivity)),
      total,
      page,
      limit,
      totalPages,
      month: monthStr,
    };
  }

  /**
   * Detail view of a neighborhood activity and its full participant list.
   * Leaders can only view activities in their own neighborhood.
   */
  async findOne(
    currentUser: UserDto,
    id: string,
  ): Promise<NeighborhoodActivityDetailDto> {
    this.checkAuthorizedRole(currentUser);

    const activity = await this.prisma.neighborhoodActivity.findUnique({
      where: { id },
      include: {
        neighborhood: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        participants: {
          include: {
            residentProfile: { select: { id: true, fullName: true } },
          },
          orderBy: [
            { residentProfile: { fullName: 'asc' } },
            { id: 'asc' },
          ],
        },
      },
    });

    if (!activity) {
      throw new AppException(
        'Không tìm thấy hoạt động khu phố.',
        HttpStatus.NOT_FOUND,
        ErrorCode.ACTIVITY_NOT_FOUND,
      );
    }

    // Scoping for Leader
    if (currentUser.role === UserRole.LEADER) {
      if (activity.neighborhoodId !== currentUser.neighborhoodId) {
        throw new AppException(
          'Bạn không có quyền truy cập hoạt động thuộc khu phố khác.',
          HttpStatus.FORBIDDEN,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    return this.formatDetailDto(activity as FullActivity);
  }

  /**
   * Updates activity metadata (name, activityDate, description).
   * Does NOT regenerate or alter participant roster.
   */
  async update(
    currentUser: UserDto,
    id: string,
    dto: UpdateNeighborhoodActivityDto,
  ): Promise<NeighborhoodActivityDetailDto> {
    this.checkAuthorizedRole(currentUser);

    let parsedActivityDate: Date | undefined;
    if (dto.activityDate !== undefined) {
      parsedActivityDate = new Date(dto.activityDate);
      if (isNaN(parsedActivityDate.getTime())) {
        throw new AppException(
          'Ngày diễn ra hoạt động không đúng định dạng ngày tháng hợp lệ.',
          HttpStatus.BAD_REQUEST,
          ErrorCode.INVALID_ACTIVITY_DATE,
        );
      }
    }

    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.neighborhoodActivity.findUnique({
            where: { id },
          });

          if (!existing) {
            throw new AppException(
              'Không tìm thấy hoạt động khu phố.',
              HttpStatus.NOT_FOUND,
              ErrorCode.ACTIVITY_NOT_FOUND,
            );
          }

          if (
            currentUser.role === UserRole.LEADER &&
            existing.neighborhoodId !== currentUser.neighborhoodId
          ) {
            throw new AppException(
              'Bạn không có quyền chỉnh sửa hoạt động thuộc khu phố khác.',
              HttpStatus.FORBIDDEN,
              ErrorCode.FORBIDDEN,
            );
          }

          const trimmedName =
            dto.name !== undefined ? dto.name.trim() : undefined;
          if (trimmedName !== undefined && trimmedName.length === 0) {
            throw new AppException(
              'Tên hoạt động không được để trống.',
              HttpStatus.BAD_REQUEST,
              ErrorCode.VALIDATION_ERROR,
            );
          }

          await tx.neighborhoodActivity.update({
            where: { id },
            data: {
              name: trimmedName,
              activityDate: parsedActivityDate,
              description:
                dto.description !== undefined
                  ? dto.description?.trim() || null
                  : undefined,
              personInCharge:
                dto.personInCharge !== undefined
                  ? dto.personInCharge?.trim() || null
                  : undefined,
            },
          });

          const full = await tx.neighborhoodActivity.findUnique({
            where: { id },
            include: {
              neighborhood: { select: { id: true, name: true } },
              createdBy: { select: { id: true, fullName: true } },
              participants: {
                include: {
                  residentProfile: { select: { id: true, fullName: true } },
                },
                orderBy: [
                  { residentProfile: { fullName: 'asc' } },
                  { id: 'asc' },
                ],
              },
            },
          });

          return full;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return this.formatDetailDto(updated as FullActivity);
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Batch updates participant attendance, notes, and rating.
   * Validates duplicate IDs and foreign non-roster participant IDs.
   * Atomically persists updates while preserving unchanged rows.
   */
  async batchUpdateParticipants(
    currentUser: UserDto,
    id: string,
    dto: BatchUpdateParticipantsDto,
  ): Promise<NeighborhoodActivityDetailDto> {
    this.checkAuthorizedRole(currentUser);

    const inputParticipants = dto.participants || [];

    // Check for duplicate participant IDs in payload
    const participantIds = inputParticipants.map((p) => p.participantId);
    const uniqueIds = new Set(participantIds);
    if (uniqueIds.size !== participantIds.length) {
      throw new AppException(
        'Danh sách cập nhật chứa mã người tham gia trùng lặp.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.DUPLICATE_PARTICIPANT,
      );
    }

    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          const activity = await tx.neighborhoodActivity.findUnique({
            where: { id },
          });

          if (!activity) {
            throw new AppException(
              'Không tìm thấy hoạt động khu phố.',
              HttpStatus.NOT_FOUND,
              ErrorCode.ACTIVITY_NOT_FOUND,
            );
          }

          if (
            currentUser.role === UserRole.LEADER &&
            activity.neighborhoodId !== currentUser.neighborhoodId
          ) {
            throw new AppException(
              'Bạn không có quyền cập nhật điểm danh hoạt động thuộc khu phố khác.',
              HttpStatus.FORBIDDEN,
              ErrorCode.FORBIDDEN,
            );
          }

          // Fetch all existing participants for this activity
          const existingParticipants =
            await tx.neighborhoodActivityParticipant.findMany({
              where: { activityId: id },
            });
          const existingMap = new Map(
            existingParticipants.map((p) => [p.id, p]),
          );

          // Verify every participantId in the update payload belongs to this activity
          for (const item of inputParticipants) {
            if (!existingMap.has(item.participantId)) {
              throw new AppException(
                `Người tham gia với mã ${item.participantId} không thuộc hoạt động này.`,
                HttpStatus.BAD_REQUEST,
                ErrorCode.INVALID_PARTICIPANT,
              );
            }
          }

          // Perform individual updates
          for (const item of inputParticipants) {
            const trimmedNotes =
              item.notes !== undefined ? item.notes?.trim() || null : undefined;

            await tx.neighborhoodActivityParticipant.update({
              where: { id: item.participantId },
              data: {
                attendance: item.attendance as unknown as DbAttendanceStatus,
                notes: trimmedNotes,
                rating:
                  item.rating !== undefined
                    ? (item.rating as unknown as DbActivityRating) || null
                    : undefined,
              },
            });
          }

          // Return full updated activity
          const full = await tx.neighborhoodActivity.findUnique({
            where: { id },
            include: {
              neighborhood: { select: { id: true, name: true } },
              createdBy: { select: { id: true, fullName: true } },
              participants: {
                include: {
                  residentProfile: { select: { id: true, fullName: true } },
                },
                orderBy: [
                  { residentProfile: { fullName: 'asc' } },
                  { id: 'asc' },
                ],
              },
            },
          });

          return full;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return this.formatDetailDto(updated as FullActivity);
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      throw error;
    }
  }
}
