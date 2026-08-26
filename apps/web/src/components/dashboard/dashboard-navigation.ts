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

export type ResidentSectionId =
  | 'overview'
  | 'announcements'
  | 'create-petition'
  | 'petitions'
  | 'account';

export type DashboardSectionId =
  | ResidentSectionId
  | LeaderSectionId
  | OfficerSectionId;

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
    | 'folder'
    | 'plus-square'
    | 'account';
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
    { id: 'overview', label: 'Tổng quan Khu phố', shortLabel: 'Tổng quan', description: 'Hàng đợi công việc và tình hình khu phố', iconName: 'overview', group: 'Quản lý' },
    { id: 'moderation', label: 'Tài khoản cư dân', shortLabel: 'Tài khoản cư dân', description: 'Phê duyệt hoặc từ chối cư dân đăng ký mới', iconName: 'user-check', badge: pendingCount > 0 ? { count: pendingCount, variant: 'warning' } : undefined, group: 'Quản lý' },
    { id: 'resident-profiles', label: 'Hồ sơ dân cư', shortLabel: 'Hồ sơ dân cư', description: 'Tra cứu thông tin cư trú và trích xuất nhân khẩu', iconName: 'users', group: 'Quản lý' },
    { id: 'announcements', label: 'Thông báo', shortLabel: 'Thông báo', description: 'Đăng tin tức, hướng dẫn và điều hành thảo luận', iconName: 'megaphone', group: 'Quản lý' },
    { id: 'petitions', label: 'Kiến nghị', shortLabel: 'Kiến nghị', description: 'Tiếp nhận và xử lý phản ánh từ cư dân', iconName: 'inbox', badge: petitionCount > 0 ? { count: petitionCount, variant: 'info' } : undefined, group: 'Quản lý' },
    { id: 'activities', label: 'Sổ hoạt động', shortLabel: 'Sổ hoạt động', description: 'Theo dõi sự kiện, phong trào và điểm danh tham gia', iconName: 'book', group: 'Quản lý' },
    { id: 'political-social', label: 'Chính trị - Xã hội', shortLabel: 'Chính trị - Xã hội', description: 'Hồ sơ Đảng viên, đoàn thể và đối tượng chính sách', iconName: 'award', group: 'Quản lý' },
    { id: 'exports', label: 'Báo cáo', shortLabel: 'Báo cáo', description: 'Xuất danh sách và sổ hoạt động dạng CSV/Excel', iconName: 'bar-chart', group: 'Quản lý' },
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
    { id: 'overview', label: 'Tổng quan địa bàn', shortLabel: 'Tổng quan', description: 'Chỉ số giám sát và thống kê toàn địa bàn', iconName: 'overview', group: 'Quản lý' },
    { id: 'analytics', label: 'Khu phố', shortLabel: 'Khu phố', description: 'Số liệu chi tiết từng tổ dân phố / khu phố', iconName: 'overview', group: 'Quản lý' },
    { id: 'leaders', label: 'Quản lý Tổ trưởng', shortLabel: 'Quản lý Tổ trưởng', description: 'Danh sách và bổ nhiệm Trưởng khu phố mới', iconName: 'user-plus', group: 'Quản lý' },
    { id: 'announcements', label: 'Thông báo', shortLabel: 'Thông báo', description: 'Phát hành thông báo diện rộng tới toàn bộ khu phố', iconName: 'megaphone', group: 'Quản lý' },
    { id: 'petitions', label: 'Kiến nghị', shortLabel: 'Kiến nghị', description: 'Theo dõi tiến độ giải quyết kiến nghị của khu phố', iconName: 'inbox', group: 'Quản lý' },
    { id: 'resident-profiles', label: 'Hồ sơ dân cư', shortLabel: 'Hồ sơ dân cư', description: 'Tra cứu nhân khẩu và trích xuất dữ liệu địa bàn', iconName: 'file-text', group: 'Quản lý' },
    { id: 'activities', label: 'Hoạt động', shortLabel: 'Hoạt động', description: 'Tổng hợp phong trào các khu phố trực thuộc', iconName: 'book', group: 'Quản lý' },
    { id: 'reports', label: 'Báo cáo', shortLabel: 'Báo cáo', description: 'Xuất báo cáo tháng, quý và năm toàn địa bàn', iconName: 'bar-chart', group: 'Quản lý' },
    { id: 'political-social', label: 'Chính trị - Xã hội', shortLabel: 'Chính trị - Xã hội', description: 'Thống kê Đảng viên và đoàn thể các khu phố', iconName: 'award', group: 'Quản lý' },
    { id: 'pending-residents', label: 'Hồ sơ chờ duyệt', shortLabel: 'Hồ sơ chờ duyệt', description: 'Theo dõi hàng đợi xét duyệt của các Trưởng khu phố', iconName: 'user-check', badge: pendingCount > 0 ? { count: pendingCount, variant: 'info' } : undefined, group: 'Quản lý' },
  ];
}

/**
 * Returns the resident-facing navigation in the order used on desktop.
 * Mobile presents the create action from the home CTA and groups it with petitions.
 */
export function getResidentNavigationItems(
  counts?: RoleNavigationCounts,
): NavigationItem[] {
  const unreadCount = counts?.unreadAnnouncementsCount ?? 0;

  return [
    { id: 'overview', label: 'Trang chủ Cư dân', shortLabel: 'Trang chủ', description: 'Thông tin mới và tiến độ kiến nghị của bạn', iconName: 'overview', group: 'Cư dân' },
    { id: 'announcements', label: 'Thông báo', shortLabel: 'Thông báo', description: 'Tin tức từ khu phố và phường', iconName: 'megaphone', badge: unreadCount > 0 ? { count: unreadCount, variant: 'destructive' } : undefined, group: 'Cư dân' },
    { id: 'create-petition', label: 'Gửi kiến nghị', shortLabel: 'Gửi kiến nghị', description: 'Gửi phản ánh mới tới ban quản lý', iconName: 'plus-square', group: 'Cư dân' },
    { id: 'petitions', label: 'Kiến nghị của tôi', shortLabel: 'Kiến nghị của tôi', description: 'Theo dõi tiến trình và phản hồi', iconName: 'file-text', group: 'Cư dân' },
    { id: 'account', label: 'Tài khoản', shortLabel: 'Tài khoản', description: 'Thông tin cư trú và tài khoản', iconName: 'account', group: 'Cư dân' },
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
  if (role === UserRole.RESIDENT) {
    return getResidentNavigationItems(counts);
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
