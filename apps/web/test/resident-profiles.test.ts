import { describe, it, expect } from 'vitest';
import {
  Gender,
  ResidentProfileDetailDto,
  ResidentProfileDto,
} from '@quanlykhupho/shared-types';

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

    const detail: ResidentProfileDetailDto = {
      ...profile,
      citizenId: '012345678789',
      phoneNumber: '+84912345678',
      email: 'tranvancudan@example.com',
    };

    expect(detail.citizenId).toBe('012345678789');
    expect(detail.phoneNumber).toBe('+84912345678');
    expect(detail.email).toBe('tranvancudan@example.com');
  });
});
