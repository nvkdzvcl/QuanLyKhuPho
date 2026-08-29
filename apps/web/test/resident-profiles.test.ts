import { describe, it, expect } from 'vitest';
import {
  CreateResidentProfileDto,
  Gender,
  HighestEducation,
  PartyStatus,
  ResidentProfileDetailDto,
  ResidentProfileDto,
  UpdateResidentProfileDto,
} from '@quanlykhupho/shared-types';
import {
  getResidentProfilesEmptyExplanation,
  hasActiveResidentFilters,
  RESIDENT_PROFILES_EMPTY_STATE_MESSAGES,
} from '../src/components/resident-profiles/resident-profile-management';

describe('Web Resident Profiles Contracts & Workflow', () => {
  it('should conform to ResidentProfileDto and ResidentProfileDetailDto contracts', () => {
    const profile: ResidentProfileDto = {
      id: 'prof-123',
      fullName: 'Trần Văn Cư Dân',
      maskedCitizenId: '012******789',
      citizenIdIssueDate: '2021-01-01T00:00:00.000Z',
      birthDate: '1985-06-15T00:00:00.000Z',
      gender: Gender.MALE,
      placeOfBirth: 'Hà Nội',
      relationshipToHead: 'Chủ hộ',
      maskedPhone: '091***5678',
      maskedEmail: 't***@example.com',
      occupation: 'Bác sĩ',
      permanentAddress: '123 Đường Lê Lợi, Phường Bến Nghé',
      currentAddress: '123 Đường Lê Lợi, Phường Bến Nghé',
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: 'hh-123',
      household: {
        id: 'hh-123',
        code: 'HK-01',
        neighborhoodId: 'neigh-1',
        address: '123 Đường Lê Lợi, Phường Bến Nghé',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      neighborhoodId: 'neigh-1',
      neighborhood: {
        id: 'neigh-1',
        code: 'KP-01',
        name: 'Khu phố 1',
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        city: 'TP. Hồ Chí Minh',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(profile.gender).toBe(Gender.MALE);
    expect(profile.maskedCitizenId).toBe('012******789');
    expect(profile.household?.code).toBe('HK-01');
    expect(profile.maskedPhone).toBe('091***5678');
    expect(profile.ward).toBe('Phường Bến Nghé');
    expect(profile.city).toBe('TP. Hồ Chí Minh');

    const detail: ResidentProfileDetailDto = {
      ...profile,
      citizenId: '012345678789',
      phoneNumber: '+84912345678',
      email: 'tranvancudan@example.com',
    };

    expect(detail.citizenId).toBe('012345678789');
    expect(detail.phoneNumber).toBe('+84912345678');
    expect(detail.email).toBe('tranvancudan@example.com');
    expect(detail.ward).toBe('Phường Bến Nghé');
    expect(detail.city).toBe('TP. Hồ Chí Minh');
  });

  it('should support locality fields (ward and city) in creation and update DTO contracts', () => {
    const createDto: CreateResidentProfileDto = {
      fullName: 'Phạm Thị Nhân Khẩu',
      citizenId: '079195000123',
      birthDate: '1995-06-15',
      permanentAddress: 'Số 789 Đường Số 1',
      householdCode: 'HK-KP01-888',
      ward: 'Phường Thử Nghiệm',
      city: 'TP. Hồ Chí Minh',
    };
    expect(createDto.ward).toBe('Phường Thử Nghiệm');
    expect(createDto.city).toBe('TP. Hồ Chí Minh');

    const updateDto: UpdateResidentProfileDto = {
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
    };
    expect(updateDto.ward).toBe('Phường Bến Nghé');
    expect(updateDto.city).toBe('TP. Hồ Chí Minh');
  });

  it('returns the first-use empty state explanation when no filters are active', () => {
    const isFiltered = hasActiveResidentFilters({});
    expect(isFiltered).toBe(false);

    const emptyExplanation = getResidentProfilesEmptyExplanation(isFiltered);
    expect(emptyExplanation).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.unfiltered,
    );
    expect(emptyExplanation).toBe(
      'Bắt đầu lập sổ bộ cư dân bằng cách nhấn nút "Thêm mới nhân khẩu" ở trên.',
    );
  });

  it('detects active basic filters and produces the filtered empty state explanation', () => {
    // Search query filter
    const searchFiltered = hasActiveResidentFilters({ search: 'Nguyễn Văn' });
    expect(searchFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(searchFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );
    expect(getResidentProfilesEmptyExplanation(searchFiltered)).toBe(
      'Không tìm thấy hồ sơ phù hợp với bộ lọc hiện tại. Thử thay đổi tiêu chí tìm kiếm.',
    );

    // Gender filter
    const genderFiltered = hasActiveResidentFilters({ gender: Gender.FEMALE });
    expect(genderFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(genderFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );

    // Neighborhood filter (for officers)
    const neighborhoodFiltered = hasActiveResidentFilters({
      neighborhoodId: 'neigh-101',
    });
    expect(neighborhoodFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(neighborhoodFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );
  });

  it('detects active advanced filters and produces the filtered empty state explanation', () => {
    // Age range (from / to, including 0)
    const ageFromFiltered = hasActiveResidentFilters({ ageFrom: 18 });
    expect(ageFromFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(ageFromFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );

    const zeroAgeFiltered = hasActiveResidentFilters({ ageFrom: 0 });
    expect(zeroAgeFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(zeroAgeFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );

    const ageToFiltered = hasActiveResidentFilters({ ageTo: 60 });
    expect(ageToFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(ageToFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );

    // Relationship to household head
    const relationshipFiltered = hasActiveResidentFilters({
      relationshipToHead: 'Chủ hộ',
    });
    expect(relationshipFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(relationshipFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );

    // Party status
    const partyFiltered = hasActiveResidentFilters({
      partyStatus: PartyStatus.PARTY_MEMBER,
    });
    expect(partyFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(partyFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );

    // Minimum education
    const educationFiltered = hasActiveResidentFilters({
      minEducation: HighestEducation.BACHELOR,
    });
    expect(educationFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(educationFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );

    // Occupation
    const occupationFiltered = hasActiveResidentFilters({
      occupation: 'Kỹ sư',
    });
    expect(occupationFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(occupationFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );

    // Ward
    const wardFiltered = hasActiveResidentFilters({
      ward: 'Phường Bến Nghé',
    });
    expect(wardFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(wardFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );
  });

  it('handles combined filters and treats empty or whitespace-only criteria as unfiltered', () => {
    // Combined advanced filters
    const combinedFiltered = hasActiveResidentFilters({
      search: 'Trần',
      partyStatus: PartyStatus.UNDER_CONSIDERATION,
      minEducation: HighestEducation.MASTER,
    });
    expect(combinedFiltered).toBe(true);
    expect(getResidentProfilesEmptyExplanation(combinedFiltered)).toBe(
      RESIDENT_PROFILES_EMPTY_STATE_MESSAGES.filtered,
    );

    // Whitespace / empty string criteria
    const emptyCriteria = {
      search: '   ',
      gender: '',
      neighborhoodId: '',
      ageFrom: '',
      ageTo: '',
      relationshipToHead: '',
      partyStatus: '',
      minEducation: '',
      occupation: '   ',
      ward: '   ',
    };

    expect(hasActiveResidentFilters(emptyCriteria)).toBe(false);
    expect(
      getResidentProfilesEmptyExplanation(
        hasActiveResidentFilters(emptyCriteria),
      ),
    ).toBe(
      'Bắt đầu lập sổ bộ cư dân bằng cách nhấn nút "Thêm mới nhân khẩu" ở trên.',
    );
  });
});
