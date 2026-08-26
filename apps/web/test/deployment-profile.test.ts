import { describe, it, expect } from 'vitest';
import type {
  ApiResponseEnvelope,
  DeploymentProfileResponseDto,
  PublicDeploymentProfileDto,
} from '@quanlykhupho/shared-types';
import {
  canAccessAuth,
  FALLBACK_BRAND_NAME,
  getDeploymentBrand,
  getDeploymentLocalityLabel,
  parseDeploymentProfileResponse,
} from '../src/hooks/use-deployment-profile';

describe('Deployment Profile - Web Contract & Parser Tests', () => {
  const validConfirmedProfile: PublicDeploymentProfileDto = {
    schemaVersion: 1,
    slug: 'phuong-an-phu',
    localityCode: '79-769-26800',
    localityName: 'Phường An Phú',
    localityLevel: 'ward',
    provinceCode: '79',
    provinceName: 'Thành phố Hồ Chí Minh',
    districtName: 'Thành phố Thủ Đức',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    brandName: 'Cổng dịch vụ Phường An Phú',
    supportEmail: 'hotro@anphu.gov.vn',
    supportHotline: '1900 1234',
    portalUrl: 'https://anphu.tphcm.gov.vn',
    confirmed: true,
    confirmedAt: '2026-08-25T08:00:00.000Z',
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-25T08:00:00.000Z',
  };

  const validDraftProfile: PublicDeploymentProfileDto = {
    schemaVersion: 1,
    slug: 'phuong-ban-nhap',
    localityCode: 'TEST-DRAFT',
    localityName: 'Phường Bản nháp',
    localityLevel: 'ward',
    provinceCode: '79',
    provinceName: 'Thành phố Hồ Chí Minh',
    districtName: null,
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    brandName: 'Cổng thông tin Bản nháp',
    supportEmail: null,
    supportHotline: null,
    portalUrl: null,
    confirmed: false,
    confirmedAt: null,
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z',
  };

  describe('parseDeploymentProfileResponse', () => {
    it('unwraps and validates a standard 200 OK wrapped ApiResponseEnvelope with confirmed profile', () => {
      const envelope: ApiResponseEnvelope<DeploymentProfileResponseDto> = {
        success: true,
        data: {
          initialized: true,
          profile: validConfirmedProfile,
        },
        timestamp: '2026-08-25T08:00:00.000Z',
      };

      const result = parseDeploymentProfileResponse(envelope);

      expect(result.initialized).toBe(true);
      expect(result.profile).not.toBeNull();
      expect(result.profile?.localityName).toBe('Phường An Phú');
      expect(result.profile?.localityLevel).toBe('ward');
      expect(result.profile?.brandName).toBe('Cổng dịch vụ Phường An Phú');
      expect(result.profile?.confirmed).toBe(true);
      expect(result.profile?.supportHotline).toBe('1900 1234');
      expect(result.profile?.supportEmail).toBe('hotro@anphu.gov.vn');
      expect(result.profile?.portalUrl).toBe('https://anphu.tphcm.gov.vn');
    });

    it('unwraps uninitialized state { initialized: false, profile: null } from envelope', () => {
      const uninitializedEnvelope: ApiResponseEnvelope<DeploymentProfileResponseDto> = {
        success: true,
        data: {
          initialized: false,
          profile: null,
        },
        timestamp: '2026-08-25T08:00:00.000Z',
      };

      const result = parseDeploymentProfileResponse(uninitializedEnvelope);

      expect(result.initialized).toBe(false);
      expect(result.profile).toBeNull();
    });

    it('unwraps direct DeploymentProfileResponseDto without envelope wrapper', () => {
      const directDto: DeploymentProfileResponseDto = {
        initialized: true,
        profile: validDraftProfile,
      };

      const result = parseDeploymentProfileResponse(directDto);

      expect(result.initialized).toBe(true);
      expect(result.profile?.localityName).toBe('Phường Bản nháp');
      expect(result.profile?.confirmed).toBe(false);
      expect(result.profile?.confirmedAt).toBeNull();
      expect(result.profile?.supportEmail).toBeNull();
    });

    it('supports commune and special_zone locality levels', () => {
      const communeProfile: PublicDeploymentProfileDto = {
        ...validConfirmedProfile,
        localityLevel: 'commune',
        localityName: 'Xã Tân Triều',
      };

      const specialZoneProfile: PublicDeploymentProfileDto = {
        ...validConfirmedProfile,
        localityLevel: 'special_zone',
        localityName: 'Đặc khu Côn Đảo',
      };

      expect(
        parseDeploymentProfileResponse({
          initialized: true,
          profile: communeProfile,
        }).profile?.localityLevel,
      ).toBe('commune');

      expect(
        parseDeploymentProfileResponse({
          initialized: true,
          profile: specialZoneProfile,
        }).profile?.localityLevel,
      ).toBe('special_zone');
    });

    it('throws error for null, undefined, and non-object inputs', () => {
      expect(() => parseDeploymentProfileResponse(null)).toThrow(
        'Phản hồi thông tin triển khai không hợp lệ',
      );
      expect(() => parseDeploymentProfileResponse(undefined)).toThrow(
        'Phản hồi thông tin triển khai không hợp lệ',
      );
      expect(() => parseDeploymentProfileResponse('invalid')).toThrow(
        'Phản hồi thông tin triển khai không hợp lệ',
      );
      expect(() => parseDeploymentProfileResponse(12345)).toThrow(
        'Phản hồi thông tin triển khai không hợp lệ',
      );
    });

    it('throws error when success is false (ApiErrorEnvelope)', () => {
      const errorEnvelope = {
        success: false,
        statusCode: 500,
        message: 'Lỗi kết nối cơ sở dữ liệu',
        timestamp: '2026-08-25T08:00:00.000Z',
      };

      expect(() => parseDeploymentProfileResponse(errorEnvelope)).toThrow(
        'Lỗi kết nối cơ sở dữ liệu',
      );
    });

    it('throws error when initialized is missing or non-boolean', () => {
      expect(() => parseDeploymentProfileResponse({})).toThrow(
        'Trường initialized không hợp lệ hoặc bị thiếu',
      );
      expect(() => parseDeploymentProfileResponse({ initialized: 'true' })).toThrow(
        'Trường initialized không hợp lệ hoặc bị thiếu',
      );
    });

    it('throws error when initialized is true but profile is null or non-object', () => {
      expect(() =>
        parseDeploymentProfileResponse({
          initialized: true,
          profile: null,
        }),
      ).toThrow('Dữ liệu hồ sơ triển khai không hợp lệ');
    });

    it('throws error on missing or invalid required string and number fields', () => {
      expect(() =>
        parseDeploymentProfileResponse({
          initialized: true,
          profile: { ...validConfirmedProfile, schemaVersion: '1' },
        }),
      ).toThrow('Trường schemaVersion không hợp lệ');

      expect(() =>
        parseDeploymentProfileResponse({
          initialized: true,
          profile: { ...validConfirmedProfile, slug: '' },
        }),
      ).toThrow('Trường slug không hợp lệ');

      expect(() =>
        parseDeploymentProfileResponse({
          initialized: true,
          profile: { ...validConfirmedProfile, localityCode: '' },
        }),
      ).toThrow('Trường localityCode không hợp lệ');

      expect(() =>
        parseDeploymentProfileResponse({
          initialized: true,
          profile: { ...validConfirmedProfile, localityName: '   ' },
        }),
      ).toThrow('Trường localityName không hợp lệ');

      expect(() =>
        parseDeploymentProfileResponse({
          initialized: true,
          profile: { ...validConfirmedProfile, localityLevel: 'country' },
        }),
      ).toThrow('Trường localityLevel không hợp lệ');

      expect(() =>
        parseDeploymentProfileResponse({
          initialized: true,
          profile: { ...validConfirmedProfile, provinceCode: '' },
        }),
      ).toThrow('Trường provinceCode không hợp lệ');

      expect(() =>
        parseDeploymentProfileResponse({
          initialized: true,
          profile: { ...validConfirmedProfile, brandName: '' },
        }),
      ).toThrow('Trường brandName không hợp lệ');

      expect(() =>
        parseDeploymentProfileResponse({
          initialized: true,
          profile: { ...validConfirmedProfile, confirmed: 'true' },
        }),
      ).toThrow('Trường confirmed không hợp lệ');
    });
  });

  describe('getDeploymentBrand', () => {
    it('returns brandName when configured in deployment profile', () => {
      expect(getDeploymentBrand(validConfirmedProfile)).toBe(
        'Cổng dịch vụ Phường An Phú',
      );
    });

    it('returns safe fallback Quản lý Khu phố when profile is null or empty', () => {
      expect(getDeploymentBrand(null)).toBe(FALLBACK_BRAND_NAME);
      expect(getDeploymentBrand(undefined)).toBe(FALLBACK_BRAND_NAME);
      expect(
        getDeploymentBrand({ ...validConfirmedProfile, brandName: '' }),
      ).toBe(FALLBACK_BRAND_NAME);
    });
  });

  describe('getDeploymentLocalityLabel', () => {
    it('formats locality and province name cleanly', () => {
      expect(getDeploymentLocalityLabel(validConfirmedProfile)).toBe(
        'Phường An Phú, Thành phố Hồ Chí Minh',
      );
    });

    it('returns null when profile or localityName is absent', () => {
      expect(getDeploymentLocalityLabel(null)).toBeNull();
      expect(getDeploymentLocalityLabel(undefined)).toBeNull();
    });
  });

  describe('canAccessAuth', () => {
    describe('in Production environment (isProduction = true)', () => {
      it('allows authentication only when profile is initialized AND confirmed', () => {
        const confirmedResponse: DeploymentProfileResponseDto = {
          initialized: true,
          profile: validConfirmedProfile,
        };

        const result = canAccessAuth(confirmedResponse, true);
        expect(result.allowed).toBe(true);
        expect(result.isDevelopmentBypass).toBeUndefined();
      });

      it('blocks authentication when profile is uninitialized (fail-closed)', () => {
        const uninitializedResponse: DeploymentProfileResponseDto = {
          initialized: false,
          profile: null,
        };

        const result = canAccessAuth(uninitializedResponse, true);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('chưa được khởi tạo cấu hình địa bàn');
      });

      it('blocks authentication when profile is draft/unconfirmed (fail-closed)', () => {
        const draftResponse: DeploymentProfileResponseDto = {
          initialized: true,
          profile: validDraftProfile,
        };

        const result = canAccessAuth(draftResponse, true);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('dự thảo');
      });

      it('blocks authentication when profileResponse is null or undefined', () => {
        const result = canAccessAuth(null, true);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('không thể kiểm tra thông tin địa bàn');
      });
    });

    describe('in Development / Test environment (isProduction = false)', () => {
      it('allows authentication even when profile is uninitialized, providing a development bypass notice', () => {
        const uninitializedResponse: DeploymentProfileResponseDto = {
          initialized: false,
          profile: null,
        };

        const result = canAccessAuth(uninitializedResponse, false);
        expect(result.allowed).toBe(true);
        expect(result.isDevelopmentBypass).toBe(true);
        expect(result.reason).toContain('Chế độ phát triển');
      });

      it('allows authentication when profile is draft/unconfirmed in development', () => {
        const draftResponse: DeploymentProfileResponseDto = {
          initialized: true,
          profile: validDraftProfile,
        };

        const result = canAccessAuth(draftResponse, false);
        expect(result.allowed).toBe(true);
        expect(result.isDevelopmentBypass).toBe(true);
      });

      it('allows authentication with no bypass notice when fully confirmed in development', () => {
        const confirmedResponse: DeploymentProfileResponseDto = {
          initialized: true,
          profile: validConfirmedProfile,
        };

        const result = canAccessAuth(confirmedResponse, false);
        expect(result.allowed).toBe(true);
        expect(result.isDevelopmentBypass).toBeUndefined();
      });
    });
  });

  describe('Security & Public Exposure Invariants', () => {
    it('does not accept or expose singletonKey, confirmedBy, internal DB IDs, or secrets in the public profile', () => {
      const rawApiPayload = {
        initialized: true,
        profile: {
          ...validConfirmedProfile,
          singletonKey: 'SINGLETON',
          confirmedBy: 'user-officer-123',
          internalId: 'uuid-1234-5678',
          secretToken: 'shhh-secret',
        },
      };

      const parsed = parseDeploymentProfileResponse(rawApiPayload);
      const parsedRecord = parsed.profile as unknown as Record<string, unknown>;

      expect(parsedRecord.singletonKey).toBeUndefined();
      expect(parsedRecord.confirmedBy).toBeUndefined();
      expect(parsedRecord.internalId).toBeUndefined();
      expect(parsedRecord.secretToken).toBeUndefined();
    });
  });
});
