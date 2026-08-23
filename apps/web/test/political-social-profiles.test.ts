import { describe, it, expect } from 'vitest';
import {
  Gender,
  HighestEducation,
  PartyStatus,
  PoliticalSocialProfileDto,
  ResidentPoliticalSocialItemDto,
  UpsertPoliticalSocialProfileDto,
} from '@quanlykhupho/shared-types';
import {
  PARTY_STATUS_LABELS,
  EDUCATION_LABELS,
} from '../src/components/political-social-profiles/political-social-management';

describe('Web Political & Social Profiles Contracts & UI Labels', () => {
  it('should have Vietnamese labels for all party status values', () => {
    expect(PARTY_STATUS_LABELS[PartyStatus.PARTY_MEMBER]).toBe('Đảng viên');
    expect(PARTY_STATUS_LABELS[PartyStatus.UNDER_CONSIDERATION]).toBe(
      'Đang xem xét',
    );
    expect(PARTY_STATUS_LABELS[PartyStatus.NOT_MEMBER]).toBe('Chưa vào Đảng');
  });

  it('should have Vietnamese labels for all education levels from THCS through Tiến sĩ', () => {
    expect(EDUCATION_LABELS[HighestEducation.LOWER_SECONDARY]).toBe(
      'Trung học cơ sở (THCS)',
    );
    expect(EDUCATION_LABELS[HighestEducation.UPPER_SECONDARY]).toBe(
      'Trung học phổ thông (THPT)',
    );
    expect(EDUCATION_LABELS[HighestEducation.VOCATIONAL]).toBe(
      'Trung cấp nghề / Sơ cấp',
    );
    expect(EDUCATION_LABELS[HighestEducation.COLLEGE]).toBe('Cao đẳng');
    expect(EDUCATION_LABELS[HighestEducation.BACHELOR]).toBe(
      'Đại học / Cử nhân',
    );
    expect(EDUCATION_LABELS[HighestEducation.MASTER]).toBe('Thạc sĩ');
    expect(EDUCATION_LABELS[HighestEducation.DOCTORATE]).toBe('Tiến sĩ');
  });

  it('should conform to ResidentPoliticalSocialItemDto and PoliticalSocialProfileDto contracts', () => {
    const psp: PoliticalSocialProfileDto = {
      id: 'psp-101',
      residentProfileId: 'res-101',
      partyStatus: PartyStatus.PARTY_MEMBER,
      partyAdmissionDate: '2019-03-26T00:00:00.000Z',
      highestEducation: HighestEducation.BACHELOR,
      specialty: 'Công nghệ thông tin',
      officialOccupation: 'Kỹ sư',
      strengths: 'Ứng dụng chuyển đổi số',
      notes: 'Đảng viên trẻ gương mẫu',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const item: ResidentPoliticalSocialItemDto = {
      id: 'res-101',
      fullName: 'Trần Văn Cư Dân',
      birthDate: '1995-03-26T00:00:00.000Z',
      gender: Gender.MALE,
      permanentAddress: '123 Đường Lê Lợi, Phường Bến Nghé',
      householdCode: 'HK-01',
      neighborhoodId: 'neigh-1',
      neighborhoodName: 'Khu phố 1',
      politicalSocialProfile: psp,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(item.politicalSocialProfile?.partyStatus).toBe(
      PartyStatus.PARTY_MEMBER,
    );
    expect(item.politicalSocialProfile?.partyAdmissionDate).toBe(
      '2019-03-26T00:00:00.000Z',
    );
    expect(item.householdCode).toBe('HK-01');
  });

  it('should correctly format UpsertPoliticalSocialProfileDto', () => {
    const upsert: UpsertPoliticalSocialProfileDto = {
      partyStatus: PartyStatus.UNDER_CONSIDERATION,
      partyAdmissionDate: null,
      highestEducation: HighestEducation.MASTER,
      specialty: 'Kinh tế học',
      officialOccupation: 'Chuyên viên nghiên cứu',
    };

    expect(upsert.partyStatus).toBe(PartyStatus.UNDER_CONSIDERATION);
    expect(upsert.partyAdmissionDate).toBeNull();
    expect(upsert.highestEducation).toBe(HighestEducation.MASTER);
  });
});
