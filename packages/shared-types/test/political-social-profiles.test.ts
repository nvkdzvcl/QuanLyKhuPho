import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  Gender,
  HighestEducation,
  PartyStatus,
  PoliticalSocialProfileDto,
  ResidentPoliticalSocialItemDto,
  UpsertPoliticalSocialProfileDto,
} from '../src';

describe('Shared Political & Social Profiles Types and Enums', () => {
  it('should have all defined party status values', () => {
    expect(PartyStatus.PARTY_MEMBER).toBe('party_member');
    expect(PartyStatus.UNDER_CONSIDERATION).toBe('under_consideration');
    expect(PartyStatus.NOT_MEMBER).toBe('not_member');
  });

  it('should have all defined highest education level values', () => {
    expect(HighestEducation.LOWER_SECONDARY).toBe('lower_secondary');
    expect(HighestEducation.UPPER_SECONDARY).toBe('upper_secondary');
    expect(HighestEducation.VOCATIONAL).toBe('vocational');
    expect(HighestEducation.COLLEGE).toBe('college');
    expect(HighestEducation.BACHELOR).toBe('bachelor');
    expect(HighestEducation.MASTER).toBe('master');
    expect(HighestEducation.DOCTORATE).toBe('doctorate');
  });

  it('should have political-social-profile specific error codes', () => {
    expect(ErrorCode.POLITICAL_SOCIAL_PROFILE_NOT_FOUND).toBe(
      'POLITICAL_SOCIAL_PROFILE_NOT_FOUND',
    );
  });

  it('should conform to PoliticalSocialProfileDto contract', () => {
    const profile: PoliticalSocialProfileDto = {
      id: 'psp-1',
      residentProfileId: 'res-prof-1',
      partyStatus: PartyStatus.PARTY_MEMBER,
      partyAdmissionDate: '2015-02-03T00:00:00.000Z',
      highestEducation: HighestEducation.BACHELOR,
      specialty: 'Công nghệ thông tin',
      officialOccupation: 'Kỹ sư phần mềm',
      strengths: 'Ứng dụng công nghệ, chuyển đổi số',
      notes: 'Đảng viên sinh hoạt chi bộ mẫu mực',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(profile.partyStatus).toBe(PartyStatus.PARTY_MEMBER);
    expect(profile.highestEducation).toBe(HighestEducation.BACHELOR);
    expect(profile.specialty).toBe('Công nghệ thông tin');
  });

  it('should conform to ResidentPoliticalSocialItemDto with null political record', () => {
    const item: ResidentPoliticalSocialItemDto = {
      id: 'res-prof-2',
      fullName: 'Trần Thị B',
      birthDate: '1995-10-20T00:00:00.000Z',
      gender: Gender.FEMALE,
      permanentAddress: '456 Hai Bà Trưng',
      householdCode: 'HK-002',
      neighborhoodId: 'neigh-1',
      neighborhoodName: 'Khu phố 1',
      politicalSocialProfile: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(item.politicalSocialProfile).toBeNull();
    expect(item.fullName).toBe('Trần Thị B');
    expect(item.householdCode).toBe('HK-002');
  });

  it('should accept valid UpsertPoliticalSocialProfileDto structure', () => {
    const upsertDto: UpsertPoliticalSocialProfileDto = {
      partyStatus: PartyStatus.UNDER_CONSIDERATION,
      partyAdmissionDate: null,
      highestEducation: HighestEducation.MASTER,
      specialty: 'Quản lý kinh tế',
      officialOccupation: 'Chuyên viên',
      strengths: 'Thuyết trình, lập kế hoạch',
      notes: 'Đang theo học lớp bồi dưỡng nhận thức về Đảng',
    };

    expect(upsertDto.partyStatus).toBe(PartyStatus.UNDER_CONSIDERATION);
    expect(upsertDto.highestEducation).toBe(HighestEducation.MASTER);
  });
});
