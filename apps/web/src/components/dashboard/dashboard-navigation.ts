import { UserRole } from '@quanlykhupho/shared-types';
import type { BadgeVariant } from '@quanlykhupho/ui';

export type LeaderSectionId =
  | 'overview'
  | 'moderation'
  | 'announcements'
  | 'petitions'
  | 'resident-profiles'
  | 'political-social'
  | 'activities'
  | 'exports';

export type OfficerSectionId =
  | 'overview'
  | 'analytics'
  | 'leaders'
  | 'reports'
  | 'announcements'
  | 'petitions'
  | 'resident-profiles'
  | 'political-social'
  | 'activities'
  | 'pending-residents';

export type DashboardSectionId = LeaderSectionId | OfficerSectionId;

export interface NavBadgeConfig {
  count: number;
  variant?: BadgeVariant;
}

export interface NavigationItem {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
  iconName:
    | 'overview'
    | 'user-check'
    | 'megaphone'
    | 'inbox'
    | 'users'
    | 'award'
    | 'book'
    | 'file-text'
    | 'bar-chart'
    | 'user-plus'
    | 'shield'
    | 'folder';
  badge?: NavBadgeConfig;
  group?: string;
}

export interface RoleNavigationCounts {
  pendingResidentsCount?: number;
  pendingPetitionsCount?: number;
  [key: string]: number | undefined;
}

export const SECTION_ALIASES: Record<string, string> = {
  'pending-residents': 'moderation',
  'account-moderation': 'moderation',
  accounts: 'moderation',
  report: 'exports',
  reports: 'exports',
  export: 'exports',
  'resident-profile': 'resident-profiles',
  residents: 'resident-profiles',
  political: 'political-social',
  activity: 'activities',
  announcement: 'announcements',
  petition: 'petitions',
};

/**
 * Returns navigation items for Leader role.
 */
export function getLeaderNavigationItems(
  counts?: RoleNavigationCounts,
): NavigationItem[] {
  const pendingCount = counts?.pendingResidentsCount ?? 0;
  const petitionCount = counts?.pendingPetitionsCount ?? 0;

  return [
    {
      id: 'overview',
      label: 'Tổng quan khu phố',
      shortLabel: 'Tổng quan',
      description: 'Hàng đợi công việc và tình hình khu phố',
      iconName: 'overview',
      group: 'Tổng quan',
    },
    {
      id: 'moderation',
      label: 'Xét duyệt tài khoản',
      shortLabel: 'Duyệt tài khoản',
      description: 'Phê duyệt hoặc từ chối cư dân đăng ký mới',
      iconName: 'user-check',
      badge:
        pendingCount > 0
          ? { count: pendingCount, variant: 'warning' }
          : undefined,
      group: 'Công việc ưu tiên',
    },
    {
      id: 'announcements',
      label: 'Bảng tin & Thông báo',
      shortLabel: 'Bảng tin',
      description: 'Đăng tin tức, hướng dẫn và điều hành thảo luận',
      iconName: 'megaphone',
      group: 'Nghiệp vụ khu phố',
    },
    {
      id: 'petitions',
      label: 'Ý kiến & Kiến nghị',
      shortLabel: 'Kiến nghị',
      description: 'Tiếp nhận và xử lý phản ánh từ cư dân',
      iconName: 'inbox',
      badge:
        petitionCount > 0
          ? { count: petitionCount, variant: 'info' }
          : undefined,
      group: 'Nghiệp vụ khu phố',
    },
    {
      id: 'resident-profiles',
      label: 'Hồ sơ Cư dân & Hộ khẩu',
      shortLabel: 'Hồ sơ cư dân',
      description: 'Tra cứu thông tin cư trú và trích xuất nhân khẩu',
      iconName: 'users',
      group: 'Quản lý cư dân',
    },
    {
      id: 'political-social',
      label: 'Chính trị - Xã hội',
      shortLabel: 'Chính trị - XH',
      description: 'Hồ sơ Đảng viên, đoàn thể và đối tượng chính sách',
      iconName: 'award',
      group: 'Quản lý cư dân',
    },
    {
      id: 'activities',
      label: 'Sổ hoạt động Khu phố',
      shortLabel: 'Sổ hoạt động',
      description: 'Theo dõi sự kiện, phong trào và điểm danh tham gia',
      iconName: 'book',
      group: 'Quản lý cư dân',
    },
    {
      id: 'exports',
      label: 'Báo cáo & Xuất dữ liệu',
      shortLabel: 'Xuất dữ liệu',
      description: 'Xuất danh sách và sổ hoạt động dạng CSV/Excel',
      iconName: 'file-text',
      group: 'Báo cáo',
    },
  ];
}

/**
 * Returns navigation items for Officer role.
 */
export function getOfficerNavigationItems(
  counts?: RoleNavigationCounts,
): NavigationItem[] {
  const pendingCount = counts?.pendingResidentsCount ?? 0;

  return [
    {
      id: 'overview',
      label: 'Tổng quan Toàn phường',
      shortLabel: 'Tổng quan',
      description: 'Chỉ số giám sát và thống kê toàn phường',
      iconName: 'overview',
      group: 'Giám sát',
    },
    {
      id: 'analytics',
      label: 'Phân tích & Chi tiết Khu phố',
      shortLabel: 'Phân tích',
      description: 'Số liệu chi tiết từng tổ dân phố / khu phố',
      iconName: 'bar-chart',
      group: 'Giám sát',
    },
    {
      id: 'leaders',
      label: 'Quản lý Trưởng khu phố',
      shortLabel: 'Trưởng khu phố',
      description: 'Danh sách và bổ nhiệm Trưởng khu phố mới',
      iconName: 'user-plus',
      group: 'Nhân sự',
    },
    {
      id: 'reports',
      label: 'Báo cáo định kỳ (FR-20)',
      shortLabel: 'Báo cáo định kỳ',
      description: 'Xuất báo cáo tháng, quý và năm toàn phường',
      iconName: 'file-text',
      group: 'Báo cáo',
    },
    {
      id: 'announcements',
      label: 'Bảng tin Cấp phường',
      shortLabel: 'Bảng tin',
      description: 'Phát hành thông báo diện rộng tới toàn bộ khu phố',
      iconName: 'megaphone',
      group: 'Điều hành',
    },
    {
      id: 'petitions',
      label: 'Giám sát Kiến nghị',
      shortLabel: 'Kiến nghị',
      description: 'Theo dõi tiến độ giải quyết kiến nghị của khu phố',
      iconName: 'inbox',
      group: 'Điều hành',
    },
    {
      id: 'resident-profiles',
      label: 'Hồ sơ Cư dân Toàn phường',
      shortLabel: 'Hồ sơ cư dân',
      description: 'Tra cứu nhân khẩu và trích xuất dữ liệu phường',
      iconName: 'users',
      group: 'Dữ liệu',
    },
    {
      id: 'political-social',
      label: 'Chính trị - Xã hội Toàn phường',
      shortLabel: 'Chính trị - XH',
      description: 'Thống kê Đảng viên và đoàn thể các khu phố',
      iconName: 'award',
      group: 'Dữ liệu',
    },
    {
      id: 'activities',
      label: 'Sổ hoạt động Toàn phường',
      shortLabel: 'Sổ hoạt động',
      description: 'Tổng hợp phong trào các khu phố trực thuộc',
      iconName: 'book',
      group: 'Dữ liệu',
    },
    {
      id: 'pending-residents',
      label: 'Giám sát Hồ sơ Chờ duyệt',
      shortLabel: 'Hồ sơ chờ',
      description: 'Theo dõi hàng đợi xét duyệt của các Trưởng khu phố',
      iconName: 'user-check',
      badge:
        pendingCount > 0
          ? { count: pendingCount, variant: 'info' }
          : undefined,
      group: 'Giám sát',
    },
  ];
}

/**
 * Returns default starting section ID for a role.
 */
export function getDefaultSectionForRole(_role: UserRole | string): string {
  return 'overview';
}

/**
 * Returns list of navigation items for a specific user role.
 */
export function getNavigationItemsForRole(
  role: UserRole | string,
  counts?: RoleNavigationCounts,
): NavigationItem[] {
  if (role === UserRole.LEADER) {
    return getLeaderNavigationItems(counts);
  }
  if (role === UserRole.OFFICER) {
    return getOfficerNavigationItems(counts);
  }
  return [
    {
      id: 'overview',
      label: 'Tổng quan',
      shortLabel: 'Tổng quan',
      description: 'Trang thông tin cư dân',
      iconName: 'overview',
    },
  ];
}

/**
 * Validates if section ID is valid for given role.
 */
export function isValidSectionForRole(
  role: UserRole | string,
  sectionId: string,
): boolean {
  if (!sectionId || typeof sectionId !== 'string') return false;
  const items = getNavigationItemsForRole(role);
  return items.some((item) => item.id === sectionId);
}

/**
 * Normalizes an arbitrary section identifier or alias to a valid section ID for the given role.
 */
export function normalizeSectionForRole(
  role: UserRole | string,
  sectionId?: string | null,
): string {
  if (!sectionId || typeof sectionId !== 'string') {
    return getDefaultSectionForRole(role);
  }
  const cleanId = sectionId.trim().toLowerCase();

  // Direct match
  if (isValidSectionForRole(role, cleanId)) {
    return cleanId;
  }

  // Check aliases
  const alias = SECTION_ALIASES[cleanId];
  if (alias && isValidSectionForRole(role, alias)) {
    return alias;
  }

  // Officer-specific preservation: 'pending-residents' and 'reports'
  if (role === UserRole.OFFICER) {
    if (cleanId === 'pending-residents' || cleanId === 'reports') {
      return cleanId;
    }
  }

  return getDefaultSectionForRole(role);
}

/**
 * Finds navigation item metadata by section ID (normalizing if needed).
 */
export function getSectionById(
  role: UserRole | string,
  sectionId: string,
): NavigationItem | undefined {
  const normalized = normalizeSectionForRole(role, sectionId);
  const items = getNavigationItemsForRole(role);
  return items.find((item) => item.id === normalized);
}
