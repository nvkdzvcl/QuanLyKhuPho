import { describe, it, expect } from 'vitest';
import {
  ActivityFilterCondition,
  ActivityParticipantDto,
  ActivityRating,
  AttendanceStatus,
  BatchUpdateParticipantsDto,
  CreateNeighborhoodActivityDto,
  NeighborhoodActivityDetailDto,
  NeighborhoodActivityDto,
} from '@quanlykhupho/shared-types';
import {
  ActivityCreationSeed,
  ACTIVITY_RATING_LABELS,
  ATTENDANCE_STATUS_LABELS,
  FILTER_CONDITION_LABELS,
} from '../src/components/neighborhood-activities/neighborhood-activity-management';

describe('Web Neighborhood Activities Contracts & UI Labels', () => {
  it('accepts a typed advanced-filter seed for custom activity creation', () => {
    const seed: ActivityCreationSeed = {
      targetNeighborhoodId: 'neigh-1',
      customResidentIds: ['resident-1', 'resident-2'],
      extractedResidents: [
        { id: 'resident-1', fullName: 'Nguyễn Văn A' },
        { id: 'resident-2', fullName: 'Trần Thị B' },
      ],
    };

    expect(seed.customResidentIds).toHaveLength(2);
    expect(seed.extractedResidents[0]?.fullName).toBe('Nguyễn Văn A');
  });

  it('should have Vietnamese labels for all 5 filter condition modes', () => {
    expect(FILTER_CONDITION_LABELS[ActivityFilterCondition.ALL]).toBe(
      'Tất cả nhân khẩu',
    );
    expect(FILTER_CONDITION_LABELS[ActivityFilterCondition.UNDER_18]).toBe(
      'Dưới 18 tuổi (< 18)',
    );
    expect(FILTER_CONDITION_LABELS[ActivityFilterCondition.OVER_18]).toBe(
      'Trên 18 tuổi (> 18)',
    );
    expect(FILTER_CONDITION_LABELS[ActivityFilterCondition.PARTY_MEMBER]).toBe(
      'Đảng viên',
    );
    expect(FILTER_CONDITION_LABELS[ActivityFilterCondition.CUSTOM]).toBe(
      'Danh sách tùy chọn',
    );
  });

  it('should have Vietnamese labels for all attendance statuses', () => {
    expect(ATTENDANCE_STATUS_LABELS[AttendanceStatus.ATTENDED]).toBe('Có mặt');
    expect(ATTENDANCE_STATUS_LABELS[AttendanceStatus.ABSENT]).toBe('Vắng mặt');
    expect(ATTENDANCE_STATUS_LABELS[AttendanceStatus.UNCONFIRMED]).toBe(
      'Chưa xác nhận',
    );
  });

  it('should have Vietnamese labels for all activity rating levels', () => {
    expect(ACTIVITY_RATING_LABELS[ActivityRating.GOOD]).toBe('Tốt');
    expect(ACTIVITY_RATING_LABELS[ActivityRating.FAIR]).toBe('Khá');
    expect(ACTIVITY_RATING_LABELS[ActivityRating.AVERAGE]).toBe('Trung bình');
  });

  it('should conform to NeighborhoodActivityDto & DetailDto contracts', () => {
    const participant: ActivityParticipantDto = {
      id: 'part-101',
      activityId: 'act-101',
      residentProfileId: 'res-101',
      fullName: 'Nguyễn Văn Cư Dân',
      attendance: AttendanceStatus.ATTENDED,
      notes: 'Tham gia đầy đủ đúng giờ',
      rating: ActivityRating.GOOD,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const activity: NeighborhoodActivityDto = {
      id: 'act-101',
      neighborhoodId: 'neigh-1',
      neighborhoodName: 'Khu phố 1',
      createdById: 'leader-1',
      createdByName: 'Trưởng Khu Phố 1',
      name: 'Họp dân quân tự vệ tháng 8/2026',
      activityDate: '2026-08-23T19:30:00.000Z',
      description: 'Phổ biến phương án tuần tra an ninh trật tự',
      personInCharge: 'Ban bảo vệ dân phố',
      filterCondition: ActivityFilterCondition.OVER_18,
      totalParticipants: 25,
      attendedCount: 22,
      absentCount: 2,
      unconfirmedCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const detail: NeighborhoodActivityDetailDto = {
      ...activity,
      participants: [participant],
    };

    expect(detail.participants.length).toBe(1);
    expect(detail.participants[0]!.attendance).toBe(AttendanceStatus.ATTENDED);
    expect(detail.participants[0]!.rating).toBe(ActivityRating.GOOD);
    expect(detail.filterCondition).toBe(ActivityFilterCondition.OVER_18);
  });

  it('should format CreateNeighborhoodActivityDto properly', () => {
    const dto: CreateNeighborhoodActivityDto = {
      name: 'Sinh hoạt chi bộ định kỳ',
      activityDate: '2026-08-25T08:00:00.000Z',
      description: 'Nghị quyết tháng 8',
      personInCharge: 'Bí thư chi bộ',
      filterCondition: ActivityFilterCondition.PARTY_MEMBER,
      neighborhoodId: 'neigh-1',
    };

    expect(dto.name).toBe('Sinh hoạt chi bộ định kỳ');
    expect(dto.personInCharge).toBe('Bí thư chi bộ');
    expect(dto.filterCondition).toBe(ActivityFilterCondition.PARTY_MEMBER);
  });

  it('should format BatchUpdateParticipantsDto properly', () => {
    const batch: BatchUpdateParticipantsDto = {
      participants: [
        {
          participantId: 'part-1',
          attendance: AttendanceStatus.ATTENDED,
          notes: 'Phát biểu tham luận',
          rating: ActivityRating.GOOD,
        },
        {
          participantId: 'part-2',
          attendance: AttendanceStatus.ABSENT,
          notes: 'Bận công tác',
          rating: null,
        },
      ],
    };

    expect(batch.participants.length).toBe(2);
    expect(batch.participants[0]!.rating).toBe(ActivityRating.GOOD);
    expect(batch.participants[1]!.notes).toBe('Bận công tác');
  });
});
