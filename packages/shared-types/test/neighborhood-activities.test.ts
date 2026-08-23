import { describe, it, expect } from 'vitest';
import {
  ActivityFilterCondition,
  ActivityRating,
  AttendanceStatus,
  ErrorCode,
  ActivityParticipantDto,
  NeighborhoodActivityDto,
  NeighborhoodActivityDetailDto,
  CreateNeighborhoodActivityDto,
  CreateNeighborhoodActivityResponseDto,
  UpdateNeighborhoodActivityDto,
  BatchUpdateParticipantsDto,
  NeighborhoodActivityMonthlyQueryDto,
  NeighborhoodActivityListResponseDto,
} from '../src';

describe('Shared Neighborhood Activities Types & Enums', () => {
  it('should have all defined ActivityFilterCondition values', () => {
    expect(ActivityFilterCondition.ALL).toBe('all');
    expect(ActivityFilterCondition.UNDER_18).toBe('under_18');
    expect(ActivityFilterCondition.OVER_18).toBe('over_18');
    expect(ActivityFilterCondition.PARTY_MEMBER).toBe('party_member');
    expect(ActivityFilterCondition.CUSTOM).toBe('custom');
  });

  it('should have all defined AttendanceStatus values', () => {
    expect(AttendanceStatus.ATTENDED).toBe('attended');
    expect(AttendanceStatus.ABSENT).toBe('absent');
    expect(AttendanceStatus.UNCONFIRMED).toBe('unconfirmed');
  });

  it('should have all defined ActivityRating values', () => {
    expect(ActivityRating.GOOD).toBe('good');
    expect(ActivityRating.FAIR).toBe('fair');
    expect(ActivityRating.AVERAGE).toBe('average');
  });

  it('should have activity-specific error codes in ErrorCode enum', () => {
    expect(ErrorCode.ACTIVITY_NOT_FOUND).toBe('ACTIVITY_NOT_FOUND');
    expect(ErrorCode.INVALID_ACTIVITY_DATE).toBe('INVALID_ACTIVITY_DATE');
    expect(ErrorCode.INVALID_PARTICIPANT).toBe('INVALID_PARTICIPANT');
    expect(ErrorCode.DUPLICATE_PARTICIPANT).toBe('DUPLICATE_PARTICIPANT');
  });

  it('should conform to ActivityParticipantDto contract', () => {
    const participant: ActivityParticipantDto = {
      id: 'part-1',
      activityId: 'act-1',
      residentProfileId: 'res-1',
      fullName: 'Nguyễn Văn A',
      attendance: AttendanceStatus.ATTENDED,
      notes: 'Tích cực phát biểu đóng góp ý kiến',
      rating: ActivityRating.GOOD,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(participant.attendance).toBe(AttendanceStatus.ATTENDED);
    expect(participant.rating).toBe(ActivityRating.GOOD);
    expect(participant.fullName).toBe('Nguyễn Văn A');
  });

  it('should conform to NeighborhoodActivityDto and DetailDto contract', () => {
    const activity: NeighborhoodActivityDto = {
      id: 'act-1',
      neighborhoodId: 'neigh-1',
      neighborhoodName: 'Khu phố 1',
      createdById: 'acc-1',
      createdByName: 'Trần Văn Trưởng',
      name: 'Họp dân phố tháng 8/2026',
      activityDate: '2026-08-23T19:00:00.000Z',
      description: 'Phổ biến kế hoạch an ninh trật tự và vệ sinh môi trường',
      personInCharge: 'Ban điều hành khu phố',
      filterCondition: ActivityFilterCondition.ALL,
      totalParticipants: 45,
      attendedCount: 40,
      absentCount: 3,
      unconfirmedCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const detail: NeighborhoodActivityDetailDto = {
      ...activity,
      participants: [
        {
          id: 'part-1',
          activityId: 'act-1',
          residentProfileId: 'res-1',
          fullName: 'Nguyễn Văn A',
          attendance: AttendanceStatus.ATTENDED,
          notes: null,
          rating: ActivityRating.GOOD,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    expect(detail.totalParticipants).toBe(45);
    expect(detail.attendedCount).toBe(40);
    expect(detail.participants.length).toBe(1);
    expect(detail.filterCondition).toBe(ActivityFilterCondition.ALL);
  });

  it('should conform to CreateNeighborhoodActivityDto and response contract', () => {
    const createDto: CreateNeighborhoodActivityDto = {
      name: 'Sinh hoạt thiếu nhi hè 2026',
      activityDate: '2026-08-25T08:00:00.000Z',
      description: 'Hoạt động trải nghiệm hè',
      personInCharge: 'Đoàn thanh niên',
      filterCondition: ActivityFilterCondition.UNDER_18,
      neighborhoodId: 'neigh-1',
    };

    const response: CreateNeighborhoodActivityResponseDto = {
      activity: {
        id: 'act-new',
        neighborhoodId: 'neigh-1',
        neighborhoodName: 'Khu phố 1',
        createdById: 'acc-1',
        createdByName: 'Trưởng khu phố',
        name: createDto.name,
        activityDate: createDto.activityDate,
        description: createDto.description,
        personInCharge: createDto.personInCharge,
        filterCondition: createDto.filterCondition,
        totalParticipants: 12,
        attendedCount: 0,
        absentCount: 0,
        unconfirmedCount: 12,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participants: [],
      },
      warning: null,
      participantCount: 12,
    };

    expect(response.participantCount).toBe(12);
    expect(response.activity.personInCharge).toBe('Đoàn thanh niên');
    expect(response.activity.filterCondition).toBe(ActivityFilterCondition.UNDER_18);
  });

  it('should conform to UpdateNeighborhoodActivityDto contract', () => {
    const updateDto: UpdateNeighborhoodActivityDto = {
      name: 'Sinh hoạt thiếu nhi hè 2026 - cập nhật',
      personInCharge: 'Chi đoàn khu phố',
    };

    expect(updateDto.personInCharge).toBe('Chi đoàn khu phố');
  });

  it('should conform to BatchUpdateParticipantsDto structure', () => {
    const batchDto: BatchUpdateParticipantsDto = {
      participants: [
        {
          participantId: 'part-1',
          attendance: AttendanceStatus.ATTENDED,
          notes: 'Đầy đủ',
          rating: ActivityRating.GOOD,
        },
        {
          participantId: 'part-2',
          attendance: AttendanceStatus.ABSENT,
          notes: 'Có phép',
          rating: null,
        },
      ],
    };

    expect(batchDto.participants.length).toBe(2);
    expect(batchDto.participants[0]!.attendance).toBe(AttendanceStatus.ATTENDED);
  });

  it('should conform to monthly query and list response contract', () => {
    const query: NeighborhoodActivityMonthlyQueryDto = {
      month: '2026-08',
      neighborhoodId: 'neigh-1',
      page: 1,
      limit: 10,
    };

    const listRes: NeighborhoodActivityListResponseDto = {
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
      month: '2026-08',
    };

    expect(query.month).toBe('2026-08');
    expect(listRes.month).toBe('2026-08');
  });
});
