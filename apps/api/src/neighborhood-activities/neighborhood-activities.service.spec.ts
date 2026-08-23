import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ActivityFilterCondition as DbActivityFilterCondition,
  ActivityRating as DbActivityRating,
  AttendanceStatus as DbAttendanceStatus,
  Gender as DbGender,
  Neighborhood,
  NeighborhoodActivityParticipant,
  PartyStatus as DbPartyStatus,
  Prisma,
} from '@prisma/client';
import {
  AccountStatus,
  ActivityFilterCondition,
  ActivityRating,
  AttendanceStatus,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import {
  calculateCalendarAge,
  NeighborhoodActivitiesService,
  ResidentWithPolitical,
} from './neighborhood-activities.service';
import { AppException } from '../core/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';

describe('NeighborhoodActivitiesService - Unit Tests', () => {
  let service: NeighborhoodActivitiesService;
  type MockPrisma = {
    neighborhood: { findUnique: ReturnType<typeof vi.fn> };
    residentProfile: { findMany: ReturnType<typeof vi.fn> };
    neighborhoodActivity: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    neighborhoodActivityParticipant: {
      createMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let mockPrisma: MockPrisma;

  const mockNeighborhood1: Neighborhood = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'KP-01',
    name: 'Khu phố 1',
    ward: 'Phường Bến Nghé',
    district: 'Quận 1',
    city: 'TP. Hồ Chí Minh',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNeighborhood2: Neighborhood = {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'KP-02',
    name: 'Khu phố 2',
    ward: 'Phường Bến Nghé',
    district: 'Quận 1',
    city: 'TP. Hồ Chí Minh',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLeader1: UserDto = {
    id: 'leader-1',
    fullName: 'Trưởng Khu Phố 1',
    maskedPhone: '090***001',
    role: UserRole.LEADER,
    status: AccountStatus.ACTIVE,
    neighborhoodId: mockNeighborhood1.id,
    neighborhood: {
      id: mockNeighborhood1.id,
      code: mockNeighborhood1.code,
      name: mockNeighborhood1.name,
      ward: mockNeighborhood1.ward,
      district: mockNeighborhood1.district,
      city: mockNeighborhood1.city,
      description: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockLeader2: UserDto = {
    id: 'leader-2',
    fullName: 'Trưởng Khu Phố 2',
    maskedPhone: '090***002',
    role: UserRole.LEADER,
    status: AccountStatus.ACTIVE,
    neighborhoodId: mockNeighborhood2.id,
    neighborhood: {
      id: mockNeighborhood2.id,
      code: mockNeighborhood2.code,
      name: mockNeighborhood2.name,
      ward: mockNeighborhood2.ward,
      district: mockNeighborhood2.district,
      city: mockNeighborhood2.city,
      description: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOfficer: UserDto = {
    id: 'officer-1',
    fullName: 'Cán Bộ Phường',
    maskedPhone: '090***003',
    role: UserRole.OFFICER,
    status: AccountStatus.ACTIVE,
    neighborhoodId: null,
    neighborhood: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockResidentUser: UserDto = {
    id: 'resident-1',
    fullName: 'Cư Dân Thường',
    maskedPhone: '090***004',
    role: UserRole.RESIDENT,
    status: AccountStatus.ACTIVE,
    neighborhoodId: mockNeighborhood1.id,
    neighborhood: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Sample resident profiles in Neighborhood 1
  const resident1_Minor: ResidentWithPolitical = {
    id: 'res-minor-1',
    fullName: 'Em Bé 15 Tuổi',
    citizenIdEncrypted: 'enc',
    citizenIdHash: 'h1',
    citizenIdIssueDate: null,
    birthDate: new Date('2011-05-10T00:00:00.000Z'), // ~15 on 2026-08-23
    gender: DbGender.male,
    placeOfBirth: null,
    relationshipToHead: 'Con',
    phoneEncrypted: null,
    emailEncrypted: null,
    occupation: 'Học sinh',
    permanentAddress: '123 Lê Lợi',
    currentAddress: null,
    ward: 'Phường Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    householdId: 'hh-1',
    neighborhoodId: mockNeighborhood1.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    politicalSocialProfile: null,
  };

  const resident2_Exact18: ResidentWithPolitical = {
    id: 'res-exact18',
    fullName: 'Bạn Tròn 18 Tuổi',
    citizenIdEncrypted: 'enc',
    citizenIdHash: 'h2',
    citizenIdIssueDate: null,
    birthDate: new Date('2008-08-23T00:00:00.000Z'), // Exactly 18 on 2026-08-23
    gender: DbGender.female,
    placeOfBirth: null,
    relationshipToHead: 'Con',
    phoneEncrypted: null,
    emailEncrypted: null,
    occupation: 'Học sinh',
    permanentAddress: '123 Lê Lợi',
    currentAddress: null,
    ward: 'Phường Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    householdId: 'hh-1',
    neighborhoodId: mockNeighborhood1.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    politicalSocialProfile: null,
  };

  const resident3_AdultParty: ResidentWithPolitical = {
    id: 'res-adult-party',
    fullName: 'Đảng Viên 35 Tuổi',
    citizenIdEncrypted: 'enc',
    citizenIdHash: 'h3',
    citizenIdIssueDate: null,
    birthDate: new Date('1991-01-15T00:00:00.000Z'), // ~35 on 2026-08-23
    gender: DbGender.male,
    placeOfBirth: null,
    relationshipToHead: 'Chủ hộ',
    phoneEncrypted: null,
    emailEncrypted: null,
    occupation: 'Kỹ sư',
    permanentAddress: '123 Lê Lợi',
    currentAddress: null,
    ward: 'Phường Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    householdId: 'hh-1',
    neighborhoodId: mockNeighborhood1.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    politicalSocialProfile: {
      id: 'psp-1',
      residentProfileId: 'res-adult-party',
      partyStatus: DbPartyStatus.party_member,
      partyAdmissionDate: new Date('2015-05-19'),
      highestEducation: null,
      specialty: null,
      officialOccupation: null,
      strengths: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const resident4_AdultNonParty: ResidentWithPolitical = {
    id: 'res-adult-nonparty',
    fullName: 'Công Dân 25 Tuổi Không Đảng',
    citizenIdEncrypted: 'enc',
    citizenIdHash: 'h4',
    citizenIdIssueDate: null,
    birthDate: new Date('2001-04-20T00:00:00.000Z'), // ~25 on 2026-08-23
    gender: DbGender.female,
    placeOfBirth: null,
    relationshipToHead: 'Chủ hộ',
    phoneEncrypted: null,
    emailEncrypted: null,
    occupation: 'Kinh doanh',
    permanentAddress: '123 Lê Lợi',
    currentAddress: null,
    ward: 'Phường Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    householdId: 'hh-1',
    neighborhoodId: mockNeighborhood1.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    politicalSocialProfile: {
      id: 'psp-2',
      residentProfileId: 'res-adult-nonparty',
      partyStatus: DbPartyStatus.not_member,
      partyAdmissionDate: null,
      highestEducation: null,
      specialty: null,
      officialOccupation: null,
      strengths: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const allKP1Residents = [
    resident1_Minor,
    resident2_Exact18,
    resident3_AdultParty,
    resident4_AdultNonParty,
  ];

  beforeEach(() => {
    mockPrisma = {
      neighborhood: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === mockNeighborhood1.id) return mockNeighborhood1;
          if (where.id === mockNeighborhood2.id) return mockNeighborhood2;
          return null;
        }),
      },
      residentProfile: {
        findMany: vi.fn(async () => allKP1Residents),
      },
      neighborhoodActivity: {
        create: vi.fn(async ({ data }: { data: Prisma.NeighborhoodActivityUncheckedCreateInput }) => ({
          id: 'act-new-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      neighborhoodActivityParticipant: {
        createMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: MockPrisma) => Promise<unknown>) => {
        return cb(mockPrisma);
      }),
    };

    service = new NeighborhoodActivitiesService(mockPrisma as unknown as PrismaService);
  });

  describe('Calendar Age Calculation & Invariants', () => {
    const activityDate = new Date('2026-08-23T00:00:00.000Z');

    it('should calculate age correctly on exact 18th birthday and match neither < 18 nor > 18', () => {
      const exact18Birth = new Date('2008-08-23T00:00:00.000Z');
      const age = calculateCalendarAge(exact18Birth, activityDate);
      expect(age).toBe(18);
      expect(age < 18).toBe(false);
      expect(age > 18).toBe(false);
    });

    it('should calculate age 17 for birth date 1 day after 18th anniversary (under 18)', () => {
      const under18Birth = new Date('2008-08-24T00:00:00.000Z');
      const age = calculateCalendarAge(under18Birth, activityDate);
      expect(age).toBe(17);
      expect(age < 18).toBe(true);
      expect(age > 18).toBe(false);
    });

    it('should calculate age 18 for birth date 1 day before 18th anniversary (neither under_18 nor over_18)', () => {
      const dayBefore18Birth = new Date('2008-08-22T00:00:00.000Z');
      const age = calculateCalendarAge(dayBefore18Birth, activityDate);
      expect(age).toBe(18);
      expect(age < 18).toBe(false);
      expect(age > 18).toBe(false);
    });

    it('should calculate age 19 for someone born in 2007 (over 18)', () => {
      const over18Birth = new Date('2007-08-23T00:00:00.000Z');
      const age = calculateCalendarAge(over18Birth, activityDate);
      expect(age).toBe(19);
      expect(age < 18).toBe(false);
      expect(age > 18).toBe(true);
    });

    it('should handle leap year birthdays correctly', () => {
      const leapBirth = new Date('2008-02-29T00:00:00.000Z');
      const feb28Act = new Date('2026-02-28T00:00:00.000Z');
      const mar01Act = new Date('2026-03-01T00:00:00.000Z');

      expect(calculateCalendarAge(leapBirth, feb28Act)).toBe(17);
      expect(calculateCalendarAge(leapBirth, mar01Act)).toBe(18);
    });
  });

  describe('Activity Creation & 5 Extraction Modes', () => {
    it('should reject unauthorized resident role with 403 FORBIDDEN', async () => {
      await expect(
        service.create(mockResidentUser, {
          name: 'Họp dân',
          activityDate: '2026-08-23T19:00:00.000Z',
          filterCondition: ActivityFilterCondition.ALL,
        }),
      ).rejects.toThrow(AppException);
    });

    it('should extract all residents under filter ALL', async () => {
      mockPrisma.neighborhoodActivity.findUnique.mockResolvedValue({
        id: 'act-new-1',
        neighborhoodId: mockNeighborhood1.id,
        createdById: mockLeader1.id,
        name: 'Họp Tổ Dân Phố',
        activityDate: new Date('2026-08-23T19:00:00.000Z'),
        description: null,
        filterCondition: DbActivityFilterCondition.all,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: mockNeighborhood1,
        createdBy: { id: mockLeader1.id, fullName: mockLeader1.fullName },
        participants: allKP1Residents.map((r) => ({
          id: `part-${r.id}`,
          activityId: 'act-new-1',
          residentProfileId: r.id,
          attendance: DbAttendanceStatus.unconfirmed,
          notes: null,
          rating: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          residentProfile: r,
        })),
      });

      const res = await service.create(mockLeader1, {
        name: 'Họp Tổ Dân Phố',
        activityDate: '2026-08-23T19:00:00.000Z',
        filterCondition: ActivityFilterCondition.ALL,
      });

      expect(res.participantCount).toBe(4);
      expect(res.warning).toBeNull();
      expect(mockPrisma.neighborhoodActivityParticipant.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ residentProfileId: 'res-minor-1' }),
          expect.objectContaining({ residentProfileId: 'res-exact18' }),
          expect.objectContaining({ residentProfileId: 'res-adult-party' }),
          expect.objectContaining({ residentProfileId: 'res-adult-nonparty' }),
        ]),
      });
    });

    it('should extract only under_18 residents (< 18)', async () => {
      mockPrisma.neighborhoodActivity.findUnique.mockResolvedValue({
        id: 'act-new-2',
        neighborhoodId: mockNeighborhood1.id,
        createdById: mockLeader1.id,
        name: 'Sinh Hoạt Hè Thiếu Nhi',
        activityDate: new Date('2026-08-23T19:00:00.000Z'),
        description: null,
        filterCondition: DbActivityFilterCondition.under_18,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: mockNeighborhood1,
        createdBy: { id: mockLeader1.id, fullName: mockLeader1.fullName },
        participants: [
          {
            id: 'part-res-minor-1',
            activityId: 'act-new-2',
            residentProfileId: resident1_Minor.id,
            attendance: DbAttendanceStatus.unconfirmed,
            notes: null,
            rating: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            residentProfile: resident1_Minor,
          },
        ],
      });

      const res = await service.create(mockLeader1, {
        name: 'Sinh Hoạt Hè Thiếu Nhi',
        activityDate: '2026-08-23T19:00:00.000Z',
        filterCondition: ActivityFilterCondition.UNDER_18,
      });

      expect(res.participantCount).toBe(1);
      expect(mockPrisma.neighborhoodActivityParticipant.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ residentProfileId: 'res-minor-1' }),
        ],
      });
    });

    it('should extract only over_18 residents (> 18, excluding exact 18)', async () => {
      mockPrisma.neighborhoodActivity.findUnique.mockResolvedValue({
        id: 'act-new-3',
        neighborhoodId: mockNeighborhood1.id,
        createdById: mockLeader1.id,
        name: 'Hội Nghị Cử Tri',
        activityDate: new Date('2026-08-23T19:00:00.000Z'),
        description: null,
        filterCondition: DbActivityFilterCondition.over_18,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: mockNeighborhood1,
        createdBy: { id: mockLeader1.id, fullName: mockLeader1.fullName },
        participants: [
          {
            id: 'part-res-adult-party',
            activityId: 'act-new-3',
            residentProfileId: resident3_AdultParty.id,
            attendance: DbAttendanceStatus.unconfirmed,
            notes: null,
            rating: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            residentProfile: resident3_AdultParty,
          },
          {
            id: 'part-res-adult-nonparty',
            activityId: 'act-new-3',
            residentProfileId: resident4_AdultNonParty.id,
            attendance: DbAttendanceStatus.unconfirmed,
            notes: null,
            rating: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            residentProfile: resident4_AdultNonParty,
          },
        ],
      });

      const res = await service.create(mockLeader1, {
        name: 'Hội Nghị Cử Tri',
        activityDate: '2026-08-23T19:00:00.000Z',
        filterCondition: ActivityFilterCondition.OVER_18,
      });

      expect(res.participantCount).toBe(2);
      expect(mockPrisma.neighborhoodActivityParticipant.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ residentProfileId: 'res-adult-party' }),
          expect.objectContaining({ residentProfileId: 'res-adult-nonparty' }),
        ]),
      });
    });

    it('should extract only party_member residents', async () => {
      mockPrisma.neighborhoodActivity.findUnique.mockResolvedValue({
        id: 'act-new-4',
        neighborhoodId: mockNeighborhood1.id,
        createdById: mockLeader1.id,
        name: 'Sinh Hoạt Chi Bộ',
        activityDate: new Date('2026-08-23T19:00:00.000Z'),
        description: null,
        filterCondition: DbActivityFilterCondition.party_member,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: mockNeighborhood1,
        createdBy: { id: mockLeader1.id, fullName: mockLeader1.fullName },
        participants: [
          {
            id: 'part-res-adult-party',
            activityId: 'act-new-4',
            residentProfileId: resident3_AdultParty.id,
            attendance: DbAttendanceStatus.unconfirmed,
            notes: null,
            rating: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            residentProfile: resident3_AdultParty,
          },
        ],
      });

      const res = await service.create(mockLeader1, {
        name: 'Sinh Hoạt Chi Bộ',
        activityDate: '2026-08-23T19:00:00.000Z',
        filterCondition: ActivityFilterCondition.PARTY_MEMBER,
      });

      expect(res.participantCount).toBe(1);
      expect(mockPrisma.neighborhoodActivityParticipant.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ residentProfileId: 'res-adult-party' }),
        ],
      });
    });

    it('should extract scoped custom resident list and deduplicate IDs', async () => {
      mockPrisma.neighborhoodActivity.findUnique.mockResolvedValue({
        id: 'act-new-5',
        neighborhoodId: mockNeighborhood1.id,
        createdById: mockLeader1.id,
        name: 'Ban Tổ Chức Sự Kiện',
        activityDate: new Date('2026-08-23T19:00:00.000Z'),
        description: null,
        filterCondition: DbActivityFilterCondition.custom,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: mockNeighborhood1,
        createdBy: { id: mockLeader1.id, fullName: mockLeader1.fullName },
        participants: [
          {
            id: 'part-1',
            activityId: 'act-new-5',
            residentProfileId: resident3_AdultParty.id,
            attendance: DbAttendanceStatus.unconfirmed,
            notes: null,
            rating: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            residentProfile: resident3_AdultParty,
          },
          {
            id: 'part-2',
            activityId: 'act-new-5',
            residentProfileId: resident4_AdultNonParty.id,
            attendance: DbAttendanceStatus.unconfirmed,
            notes: null,
            rating: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            residentProfile: resident4_AdultNonParty,
          },
        ],
      });

      const res = await service.create(mockLeader1, {
        name: 'Ban Tổ Chức Sự Kiện',
        activityDate: '2026-08-23T19:00:00.000Z',
        filterCondition: ActivityFilterCondition.CUSTOM,
        customResidentIds: [
          'res-adult-party',
          'res-adult-nonparty',
          'res-adult-party', // duplicate to verify deduplication
        ],
      });

      expect(res.participantCount).toBe(2);
      expect(mockPrisma.neighborhoodActivityParticipant.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ residentProfileId: 'res-adult-party' }),
          expect.objectContaining({ residentProfileId: 'res-adult-nonparty' }),
        ]),
      });
    });

    it('should reject custom resident selection containing foreign or non-existent resident ID', async () => {
      await expect(
        service.create(mockLeader1, {
          name: 'Ban Tổ Chức',
          activityDate: '2026-08-23T19:00:00.000Z',
          filterCondition: ActivityFilterCondition.CUSTOM,
          customResidentIds: ['non-existent-or-foreign-id'],
        }),
      ).rejects.toThrow(AppException);
    });

    it('should return warning when extracted roster is empty', async () => {
      mockPrisma.residentProfile.findMany.mockResolvedValue([]); // no residents

      mockPrisma.neighborhoodActivity.findUnique.mockResolvedValue({
        id: 'act-empty',
        neighborhoodId: mockNeighborhood1.id,
        createdById: mockLeader1.id,
        name: 'Hoạt Động Trống',
        activityDate: new Date('2026-08-23T19:00:00.000Z'),
        description: null,
        filterCondition: DbActivityFilterCondition.all,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: mockNeighborhood1,
        createdBy: { id: mockLeader1.id, fullName: mockLeader1.fullName },
        participants: [],
      });

      const res = await service.create(mockLeader1, {
        name: 'Hoạt Động Trống',
        activityDate: '2026-08-23T19:00:00.000Z',
        filterCondition: ActivityFilterCondition.ALL,
      });

      expect(res.participantCount).toBe(0);
      expect(res.warning).not.toBeNull();
      expect(mockPrisma.neighborhoodActivityParticipant.createMany).not.toHaveBeenCalled();
    });
  });

  describe('Leader & Officer Scoping', () => {
    it('should prevent Leader 1 from accessing an activity in Neighborhood 2', async () => {
      mockPrisma.neighborhoodActivity.findUnique.mockResolvedValue({
        id: 'act-kp2',
        neighborhoodId: mockNeighborhood2.id,
        createdById: mockLeader2.id,
        name: 'Hoạt động KP2',
        activityDate: new Date(),
        description: null,
        filterCondition: DbActivityFilterCondition.all,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: mockNeighborhood2,
        createdBy: { id: mockLeader2.id, fullName: mockLeader2.fullName },
        participants: [],
      });

      await expect(
        service.findOne(mockLeader1, 'act-kp2'),
      ).rejects.toThrow(AppException);

      await expect(
        service.update(mockLeader1, 'act-kp2', { name: 'Tên mới' }),
      ).rejects.toThrow(AppException);

      await expect(
        service.batchUpdateParticipants(mockLeader1, 'act-kp2', {
          participants: [],
        }),
      ).rejects.toThrow(AppException);
    });

    it('should allow Officer to access any activity across neighborhoods', async () => {
      mockPrisma.neighborhoodActivity.findUnique.mockResolvedValue({
        id: 'act-kp2',
        neighborhoodId: mockNeighborhood2.id,
        createdById: mockLeader2.id,
        name: 'Hoạt động KP2',
        activityDate: new Date(),
        description: null,
        filterCondition: DbActivityFilterCondition.all,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: mockNeighborhood2,
        createdBy: { id: mockLeader2.id, fullName: mockLeader2.fullName },
        participants: [],
      });

      const res = await service.findOne(mockOfficer, 'act-kp2');
      expect(res.id).toBe('act-kp2');
      expect(res.neighborhoodId).toBe(mockNeighborhood2.id);
    });
  });

  describe('Batch Participant Updates & Integrity', () => {
    const existingParticipants: NeighborhoodActivityParticipant[] = [
      {
        id: 'part-1',
        activityId: 'act-1',
        residentProfileId: 'res-1',
        attendance: DbAttendanceStatus.unconfirmed,
        notes: null,
        rating: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'part-2',
        activityId: 'act-1',
        residentProfileId: 'res-2',
        attendance: DbAttendanceStatus.unconfirmed,
        notes: null,
        rating: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    beforeEach(() => {
      mockPrisma.neighborhoodActivity.findUnique.mockResolvedValue({
        id: 'act-1',
        neighborhoodId: mockNeighborhood1.id,
        createdById: mockLeader1.id,
        name: 'Họp dân phố',
        activityDate: new Date('2026-08-23T19:00:00.000Z'),
        description: null,
        filterCondition: DbActivityFilterCondition.all,
        createdAt: new Date(),
        updatedAt: new Date(),
        neighborhood: mockNeighborhood1,
        createdBy: { id: mockLeader1.id, fullName: mockLeader1.fullName },
        participants: existingParticipants.map((p) => ({
          ...p,
          residentProfile: {
            id: p.residentProfileId,
            fullName: p.residentProfileId === 'res-1' ? 'Nguyễn Văn A' : 'Trần Thị B',
            birthDate: new Date('1990-01-01'),
            gender: DbGender.male,
          },
        })),
      });

      mockPrisma.neighborhoodActivityParticipant.findMany.mockResolvedValue(
        existingParticipants,
      );
    });

    it('should atomically update attendance, notes, and rating for specified participants', async () => {
      const res = await service.batchUpdateParticipants(mockLeader1, 'act-1', {
        participants: [
          {
            participantId: 'part-1',
            attendance: AttendanceStatus.ATTENDED,
            notes: 'Tham gia tích cực',
            rating: ActivityRating.GOOD,
          },
        ],
      });

      expect(mockPrisma.neighborhoodActivityParticipant.update).toHaveBeenCalledWith({
        where: { id: 'part-1' },
        data: {
          attendance: DbAttendanceStatus.attended,
          notes: 'Tham gia tích cực',
          rating: DbActivityRating.good,
        },
      });
      expect(res.id).toBe('act-1');
    });

    it('should reject batch update with duplicate participant IDs', async () => {
      await expect(
        service.batchUpdateParticipants(mockLeader1, 'act-1', {
          participants: [
            {
              participantId: 'part-1',
              attendance: AttendanceStatus.ATTENDED,
            },
            {
              participantId: 'part-1', // duplicate
              attendance: AttendanceStatus.ABSENT,
            },
          ],
        }),
      ).rejects.toThrow(AppException);
    });

    it('should reject batch update with non-roster foreign participant ID', async () => {
      await expect(
        service.batchUpdateParticipants(mockLeader1, 'act-1', {
          participants: [
            {
              participantId: 'part-999-foreign',
              attendance: AttendanceStatus.ATTENDED,
            },
          ],
        }),
      ).rejects.toThrow(AppException);
    });
  });
});
