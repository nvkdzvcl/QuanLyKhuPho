import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  Gender,
  ResidentProfileDto,
  ResidentProfileDetailDto,
  CreateResidentProfileDto,
  HouseholdDto,
} from '../src';

describe('Shared Resident Profile Types and Enums', () => {
  it('should have all defined gender values', () => {
    expect(Gender.MALE).toBe('male');
    expect(Gender.FEMALE).toBe('female');
    expect(Gender.OTHER).toBe('other');
  });

  it('should have resident-profile specific error codes', () => {
    expect(ErrorCode.CITIZEN_ID_ALREADY_EXISTS).toBe('CITIZEN_ID_ALREADY_EXISTS');
    expect(ErrorCode.RESIDENT_PROFILE_NOT_FOUND).toBe('RESIDENT_PROFILE_NOT_FOUND');
    expect(ErrorCode.HOUSEHOLD_NOT_FOUND).toBe('HOUSEHOLD_NOT_FOUND');
    expect(ErrorCode.INVALID_CITIZEN_ID).toBe('INVALID_CITIZEN_ID');
  });

  it('should conform to HouseholdDto and ResidentProfileDto contracts', () => {
    const household: HouseholdDto = {
      id: 'hh-1',
      code: 'HK-001',
      neighborhoodId: 'neigh-1',
      address: '123 Đường Lê Lợi, Phường Bến Nghé',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const profile: ResidentProfileDto = {
      id: 'prof-1',
      fullName: 'Nguyễn Văn A',
      maskedCitizenId: '012******789',
      citizenIdIssueDate: '2020-01-01T00:00:00.000Z',
      birthDate: '1990-05-15T00:00:00.000Z',
      gender: Gender.MALE,
      placeOfBirth: 'Hà Nội',
      relationshipToHead: 'Chủ hộ',
      maskedPhone: '090***1234',
      maskedEmail: 'a***@example.com',
      occupation: 'Kỹ sư',
      permanentAddress: '123 Đường Lê Lợi, Phường Bến Nghé',
      currentAddress: '123 Đường Lê Lợi, Phường Bến Nghé',
      ward: 'Phường Bến Nghé',
      city: 'TP. Hồ Chí Minh',
      householdId: household.id,
      household,
      neighborhoodId: 'neigh-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(profile.gender).toBe(Gender.MALE);
    expect(profile.maskedCitizenId).toBe('012******789');
    expect(profile.household?.code).toBe('HK-001');

    const detail: ResidentProfileDetailDto = {
      ...profile,
      citizenId: '012345678789',
      phoneNumber: '+84901234567',
      email: 'anv@example.com',
    };

    expect(detail.citizenId).toBe('012345678789');
    expect(detail.phoneNumber).toBe('+84901234567');
  });

  it('should accept valid CreateResidentProfileDto structure', () => {
    const createDto: CreateResidentProfileDto = {
      fullName: 'Trần Thị B',
      citizenId: '079199000123',
      birthDate: '1995-10-20T00:00:00.000Z',
      gender: Gender.FEMALE,
      householdCode: 'HK-002',
      permanentAddress: '456 Đường Hai Bà Trưng',
    };

    expect(createDto.fullName).toBe('Trần Thị B');
    expect(createDto.citizenId).toBe('079199000123');
    expect(createDto.gender).toBe(Gender.FEMALE);
  });
});
