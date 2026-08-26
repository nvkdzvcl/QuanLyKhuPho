import { useQuery } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  DeploymentProfileResponseDto,
  LocalityLevel,
  PublicDeploymentProfileDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../lib/api-client';

export const FALLBACK_BRAND_NAME = 'Quản lý Khu phố';

const VALID_LOCALITY_LEVELS: ReadonlySet<string> = new Set<LocalityLevel>([
  'ward',
  'commune',
  'special_zone',
]);

/**
 * Validates and normalizes raw API response into a typed DeploymentProfileResponseDto.
 * Rejects malformed envelopes, invalid property types, and missing required fields.
 */
export function parseDeploymentProfileResponse(
  payload: unknown,
): DeploymentProfileResponseDto {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Phản hồi thông tin triển khai không hợp lệ');
  }

  const record = payload as Record<string, unknown>;

  // Detect and reject ApiErrorEnvelope
  if (record.success === false) {
    throw new Error(
      typeof record.message === 'string'
        ? record.message
        : 'Yêu cầu lấy thông tin triển khai thất bại',
    );
  }

  // Support both wrapped ApiResponseEnvelope<DeploymentProfileResponseDto> and direct DTO
  const rawData: unknown =
    typeof record.data === 'object' && record.data !== null
      ? record.data
      : payload;

  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Dữ liệu cấu hình triển khai không hợp lệ');
  }

  const candidate = rawData as Record<string, unknown>;

  if (typeof candidate.initialized !== 'boolean') {
    throw new Error('Trường initialized không hợp lệ hoặc bị thiếu');
  }

  if (!candidate.initialized) {
    return {
      initialized: false,
      profile: null,
    };
  }

  if (typeof candidate.profile !== 'object' || candidate.profile === null) {
    throw new Error('Dữ liệu hồ sơ triển khai không hợp lệ');
  }

  const rawProfile = candidate.profile as Record<string, unknown>;

  if (typeof rawProfile.schemaVersion !== 'number') {
    throw new Error('Trường schemaVersion không hợp lệ');
  }
  if (typeof rawProfile.slug !== 'string' || !rawProfile.slug.trim()) {
    throw new Error('Trường slug không hợp lệ');
  }
  if (typeof rawProfile.localityCode !== 'string' || !rawProfile.localityCode.trim()) {
    throw new Error('Trường localityCode không hợp lệ');
  }
  if (typeof rawProfile.localityName !== 'string' || !rawProfile.localityName.trim()) {
    throw new Error('Trường localityName không hợp lệ');
  }
  if (
    typeof rawProfile.localityLevel !== 'string' ||
    !VALID_LOCALITY_LEVELS.has(rawProfile.localityLevel)
  ) {
    throw new Error('Trường localityLevel không hợp lệ');
  }
  if (typeof rawProfile.provinceCode !== 'string' || !rawProfile.provinceCode.trim()) {
    throw new Error('Trường provinceCode không hợp lệ');
  }
  if (typeof rawProfile.provinceName !== 'string' || !rawProfile.provinceName.trim()) {
    throw new Error('Trường provinceName không hợp lệ');
  }
  if (typeof rawProfile.timezone !== 'string' || !rawProfile.timezone.trim()) {
    throw new Error('Trường timezone không hợp lệ');
  }
  if (typeof rawProfile.locale !== 'string' || !rawProfile.locale.trim()) {
    throw new Error('Trường locale không hợp lệ');
  }
  if (typeof rawProfile.brandName !== 'string' || !rawProfile.brandName.trim()) {
    throw new Error('Trường brandName không hợp lệ');
  }
  if (typeof rawProfile.confirmed !== 'boolean') {
    throw new Error('Trường confirmed không hợp lệ');
  }
  if (typeof rawProfile.createdAt !== 'string') {
    throw new Error('Trường createdAt không hợp lệ');
  }
  if (typeof rawProfile.updatedAt !== 'string') {
    throw new Error('Trường updatedAt không hợp lệ');
  }

  const profile: PublicDeploymentProfileDto = {
    schemaVersion: rawProfile.schemaVersion,
    slug: rawProfile.slug,
    localityCode: rawProfile.localityCode,
    localityName: rawProfile.localityName,
    localityLevel: rawProfile.localityLevel as LocalityLevel,
    provinceCode: rawProfile.provinceCode,
    provinceName: rawProfile.provinceName,
    districtName:
      typeof rawProfile.districtName === 'string' ? rawProfile.districtName : null,
    timezone: rawProfile.timezone,
    locale: rawProfile.locale,
    brandName: rawProfile.brandName,
    supportEmail:
      typeof rawProfile.supportEmail === 'string' ? rawProfile.supportEmail : null,
    supportHotline:
      typeof rawProfile.supportHotline === 'string' ? rawProfile.supportHotline : null,
    portalUrl:
      typeof rawProfile.portalUrl === 'string' ? rawProfile.portalUrl : null,
    confirmed: rawProfile.confirmed,
    confirmedAt:
      typeof rawProfile.confirmedAt === 'string' ? rawProfile.confirmedAt : null,
    createdAt: rawProfile.createdAt,
    updatedAt: rawProfile.updatedAt,
  };

  return {
    initialized: true,
    profile,
  };
}

/**
 * Fetches the public deployment profile from the backend API.
 */
export async function fetchDeploymentProfile(): Promise<DeploymentProfileResponseDto> {
  const res = await apiClient.get<ApiResponseEnvelope<DeploymentProfileResponseDto>>(
    '/deployment-profile',
  );
  return parseDeploymentProfileResponse(res.data);
}

/**
 * React Query hook to consume the singleton deployment profile.
 */
export function useDeploymentProfile() {
  return useQuery({
    queryKey: ['deployment-profile'],
    queryFn: () => fetchDeploymentProfile(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Returns the brand name configured for the deployment with safe fallback.
 */
export function getDeploymentBrand(
  profile?: PublicDeploymentProfileDto | null,
): string {
  return profile?.brandName?.trim() || FALLBACK_BRAND_NAME;
}

/**
 * Formats locality name and province for concise display.
 */
export function getDeploymentLocalityLabel(
  profile?: PublicDeploymentProfileDto | null,
): string | null {
  if (!profile?.localityName) {
    return null;
  }
  if (profile.provinceName) {
    return `${profile.localityName}, ${profile.provinceName}`;
  }
  return profile.localityName;
}

export interface AuthAccessStatus {
  allowed: boolean;
  reason?: string;
  isDevelopmentBypass?: boolean;
}

/**
 * Checks whether user can proceed with authentication based on deployment profile and environment.
 * In production: strictly requires an initialized and confirmed profile.
 * In development/test: allows access even if uninitialized/unconfirmed, indicating bypass.
 */
export function canAccessAuth(
  profileResponse?: DeploymentProfileResponseDto | null,
  isProduction: boolean = process.env.NODE_ENV === 'production',
): AuthAccessStatus {
  if (!isProduction) {
    if (!profileResponse?.initialized || !profileResponse.profile?.confirmed) {
      return {
        allowed: true,
        isDevelopmentBypass: true,
        reason: 'Chế độ phát triển: Đang cho phép đăng nhập thử nghiệm dù cấu hình chưa xác nhận.',
      };
    }
    return { allowed: true };
  }

  if (!profileResponse) {
    return {
      allowed: false,
      reason: 'Hệ thống đang tải hoặc không thể kiểm tra thông tin địa bàn.',
    };
  }

  if (!profileResponse.initialized || !profileResponse.profile) {
    return {
      allowed: false,
      reason: 'Hệ thống chưa được khởi tạo cấu hình địa bàn. Vui lòng liên hệ quản trị viên.',
    };
  }

  if (!profileResponse.profile.confirmed) {
    return {
      allowed: false,
      reason: 'Cấu hình địa bàn đang ở trạng thái dự thảo (chưa xác nhận). Hệ thống chưa sẵn sàng vận hành chính thức.',
    };
  }

  return { allowed: true };
}
