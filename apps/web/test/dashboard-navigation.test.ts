import { describe, it, expect } from 'vitest';
import { UserRole } from '@quanlykhupho/shared-types';
import {
  getLeaderNavigationItems,
  getOfficerNavigationItems,
  getNavigationItemsForRole,
  getDefaultSectionForRole,
  isValidSectionForRole,
  normalizeSectionForRole,
  getSectionById,
  SECTION_ALIASES,
} from '../src/components/dashboard/dashboard-navigation';

describe('Dashboard Navigation Configuration & Contracts', () => {
  describe('getLeaderNavigationItems', () => {
    it('should return all 8 required leader sections', () => {
      const items = getLeaderNavigationItems();
      expect(items).toHaveLength(8);

      const sectionIds = items.map((i) => i.id);
      expect(sectionIds).toEqual([
        'overview',
        'moderation',
        'announcements',
        'petitions',
        'resident-profiles',
        'political-social',
        'activities',
        'exports',
      ]);
    });

    it('should include non-empty labels, shortLabels, icons, and groups for every item', () => {
      const items = getLeaderNavigationItems();
      items.forEach((item) => {
        expect(item.id).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.shortLabel).toBeTruthy();
        expect(item.iconName).toBeTruthy();
        expect(item.group).toBeTruthy();
      });
    });

    it('should attach a warning badge to moderation when pending residents exist', () => {
      const itemsWithPending = getLeaderNavigationItems({
        pendingResidentsCount: 5,
      });
      const modItem = itemsWithPending.find((i) => i.id === 'moderation');
      expect(modItem?.badge).toEqual({ count: 5, variant: 'warning' });

      const itemsZeroPending = getLeaderNavigationItems({
        pendingResidentsCount: 0,
      });
      const modItemZero = itemsZeroPending.find((i) => i.id === 'moderation');
      expect(modItemZero?.badge).toBeUndefined();

      const itemsNoCounts = getLeaderNavigationItems();
      const modItemNone = itemsNoCounts.find((i) => i.id === 'moderation');
      expect(modItemNone?.badge).toBeUndefined();
    });

    it('should attach an info badge to petitions when petition count > 0', () => {
      const items = getLeaderNavigationItems({
        pendingPetitionsCount: 3,
      });
      const petitionItem = items.find((i) => i.id === 'petitions');
      expect(petitionItem?.badge).toEqual({ count: 3, variant: 'info' });
    });

    it('should maintain unique section IDs', () => {
      const items = getLeaderNavigationItems();
      const ids = items.map((i) => i.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getOfficerNavigationItems', () => {
    it('should return all required officer oversight sections', () => {
      const items = getOfficerNavigationItems();
      expect(items).toHaveLength(10);

      const sectionIds = items.map((i) => i.id);
      expect(sectionIds).toEqual([
        'overview',
        'analytics',
        'leaders',
        'reports',
        'announcements',
        'petitions',
        'resident-profiles',
        'political-social',
        'activities',
        'pending-residents',
      ]);
    });

    it('should include non-empty labels, shortLabels, icons, and groups for every officer item', () => {
      const items = getOfficerNavigationItems();
      items.forEach((item) => {
        expect(item.id).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.shortLabel).toBeTruthy();
        expect(item.iconName).toBeTruthy();
        expect(item.group).toBeTruthy();
      });
    });

    it('should attach info badge to pending-residents when pending count > 0', () => {
      const items = getOfficerNavigationItems({
        pendingResidentsCount: 12,
      });
      const pendingItem = items.find((i) => i.id === 'pending-residents');
      expect(pendingItem?.badge).toEqual({ count: 12, variant: 'info' });

      const itemsZero = getOfficerNavigationItems({
        pendingResidentsCount: 0,
      });
      const zeroItem = itemsZero.find((i) => i.id === 'pending-residents');
      expect(zeroItem?.badge).toBeUndefined();
    });

    it('should maintain unique section IDs for officer items', () => {
      const items = getOfficerNavigationItems();
      const ids = items.map((i) => i.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getNavigationItemsForRole', () => {
    it('should return leader items for UserRole.LEADER', () => {
      const items = getNavigationItemsForRole(UserRole.LEADER);
      expect(items).toEqual(getLeaderNavigationItems());
    });

    it('should return officer items for UserRole.OFFICER', () => {
      const items = getNavigationItemsForRole(UserRole.OFFICER);
      expect(items).toEqual(getOfficerNavigationItems());
    });

    it('should return single overview item for resident or unhandled role', () => {
      const itemsResident = getNavigationItemsForRole(UserRole.RESIDENT);
      expect(itemsResident).toHaveLength(1);
      expect(itemsResident[0]?.id).toBe('overview');

      const itemsUnknown = getNavigationItemsForRole('unknown_role');
      expect(itemsUnknown).toHaveLength(1);
      expect(itemsUnknown[0]?.id).toBe('overview');
    });
  });

  describe('getDefaultSectionForRole', () => {
    it('should return overview for all roles', () => {
      expect(getDefaultSectionForRole(UserRole.LEADER)).toBe('overview');
      expect(getDefaultSectionForRole(UserRole.OFFICER)).toBe('overview');
      expect(getDefaultSectionForRole(UserRole.RESIDENT)).toBe('overview');
    });
  });

  describe('isValidSectionForRole', () => {
    it('should return true for valid sections of Leader role', () => {
      expect(isValidSectionForRole(UserRole.LEADER, 'overview')).toBe(true);
      expect(isValidSectionForRole(UserRole.LEADER, 'moderation')).toBe(true);
      expect(isValidSectionForRole(UserRole.LEADER, 'announcements')).toBe(true);
      expect(isValidSectionForRole(UserRole.LEADER, 'petitions')).toBe(true);
      expect(isValidSectionForRole(UserRole.LEADER, 'resident-profiles')).toBe(true);
      expect(isValidSectionForRole(UserRole.LEADER, 'political-social')).toBe(true);
      expect(isValidSectionForRole(UserRole.LEADER, 'activities')).toBe(true);
      expect(isValidSectionForRole(UserRole.LEADER, 'exports')).toBe(true);
    });

    it('should return false for invalid or cross-role sections for Leader', () => {
      expect(isValidSectionForRole(UserRole.LEADER, 'analytics')).toBe(false);
      expect(isValidSectionForRole(UserRole.LEADER, 'leaders')).toBe(false);
      expect(isValidSectionForRole(UserRole.LEADER, 'non_existent_section')).toBe(false);
      expect(isValidSectionForRole(UserRole.LEADER, '')).toBe(false);
    });

    it('should return true for valid sections of Officer role', () => {
      expect(isValidSectionForRole(UserRole.OFFICER, 'overview')).toBe(true);
      expect(isValidSectionForRole(UserRole.OFFICER, 'analytics')).toBe(true);
      expect(isValidSectionForRole(UserRole.OFFICER, 'leaders')).toBe(true);
      expect(isValidSectionForRole(UserRole.OFFICER, 'reports')).toBe(true);
      expect(isValidSectionForRole(UserRole.OFFICER, 'announcements')).toBe(true);
      expect(isValidSectionForRole(UserRole.OFFICER, 'petitions')).toBe(true);
      expect(isValidSectionForRole(UserRole.OFFICER, 'resident-profiles')).toBe(true);
      expect(isValidSectionForRole(UserRole.OFFICER, 'political-social')).toBe(true);
      expect(isValidSectionForRole(UserRole.OFFICER, 'activities')).toBe(true);
      expect(isValidSectionForRole(UserRole.OFFICER, 'pending-residents')).toBe(true);
    });

    it('should return false for invalid sections for Officer role', () => {
      expect(isValidSectionForRole(UserRole.OFFICER, 'moderation')).toBe(false);
      expect(isValidSectionForRole(UserRole.OFFICER, 'exports')).toBe(false);
      expect(isValidSectionForRole(UserRole.OFFICER, 'non_existent_section')).toBe(false);
      expect(isValidSectionForRole(UserRole.OFFICER, '')).toBe(false);
    });
  });

  describe('normalizeSectionForRole', () => {
    it('should return overview when sectionId is null, undefined, empty, or whitespace', () => {
      expect(normalizeSectionForRole(UserRole.LEADER, null)).toBe('overview');
      expect(normalizeSectionForRole(UserRole.LEADER, undefined)).toBe('overview');
      expect(normalizeSectionForRole(UserRole.LEADER, '')).toBe('overview');
      expect(normalizeSectionForRole(UserRole.LEADER, '   ')).toBe('overview');
    });

    it('should return the sectionId if it is already valid', () => {
      expect(normalizeSectionForRole(UserRole.LEADER, 'moderation')).toBe('moderation');
      expect(normalizeSectionForRole(UserRole.LEADER, 'petitions')).toBe('petitions');
      expect(normalizeSectionForRole(UserRole.LEADER, 'activities')).toBe('activities');
    });

    it('should normalize known aliases for Leader role', () => {
      expect(normalizeSectionForRole(UserRole.LEADER, 'pending-residents')).toBe('moderation');
      expect(normalizeSectionForRole(UserRole.LEADER, 'account-moderation')).toBe('moderation');
      expect(normalizeSectionForRole(UserRole.LEADER, 'accounts')).toBe('moderation');
      expect(normalizeSectionForRole(UserRole.LEADER, 'reports')).toBe('exports');
      expect(normalizeSectionForRole(UserRole.LEADER, 'report')).toBe('exports');
      expect(normalizeSectionForRole(UserRole.LEADER, 'export')).toBe('exports');
      expect(normalizeSectionForRole(UserRole.LEADER, 'residents')).toBe('resident-profiles');
      expect(normalizeSectionForRole(UserRole.LEADER, 'resident-profile')).toBe('resident-profiles');
      expect(normalizeSectionForRole(UserRole.LEADER, 'political')).toBe('political-social');
      expect(normalizeSectionForRole(UserRole.LEADER, 'activity')).toBe('activities');
      expect(normalizeSectionForRole(UserRole.LEADER, 'announcement')).toBe('announcements');
      expect(normalizeSectionForRole(UserRole.LEADER, 'petition')).toBe('petitions');
    });

    it('should normalize known aliases for Officer role', () => {
      expect(normalizeSectionForRole(UserRole.OFFICER, 'residents')).toBe('resident-profiles');
      expect(normalizeSectionForRole(UserRole.OFFICER, 'resident-profile')).toBe('resident-profiles');
      expect(normalizeSectionForRole(UserRole.OFFICER, 'political')).toBe('political-social');
      expect(normalizeSectionForRole(UserRole.OFFICER, 'activity')).toBe('activities');
      expect(normalizeSectionForRole(UserRole.OFFICER, 'announcement')).toBe('announcements');
      expect(normalizeSectionForRole(UserRole.OFFICER, 'petition')).toBe('petitions');
    });

    it('should preserve officer-specific sections without aliasing them incorrectly', () => {
      expect(normalizeSectionForRole(UserRole.OFFICER, 'reports')).toBe('reports');
      expect(normalizeSectionForRole(UserRole.OFFICER, 'pending-residents')).toBe('pending-residents');
    });

    it('should fallback to default overview for unknown section IDs', () => {
      expect(normalizeSectionForRole(UserRole.LEADER, 'unknown-xyz')).toBe('overview');
      expect(normalizeSectionForRole(UserRole.LEADER, 'leaders')).toBe('overview');
    });
  });

  describe('getSectionById', () => {
    it('should return matching item metadata for valid section ID', () => {
      const item = getSectionById(UserRole.LEADER, 'moderation');
      expect(item).toBeDefined();
      expect(item?.id).toBe('moderation');
      expect(item?.label).toBe('Xét duyệt tài khoản');
    });

    it('should return matching item metadata when passing an alias', () => {
      const item = getSectionById(UserRole.LEADER, 'pending-residents');
      expect(item).toBeDefined();
      expect(item?.id).toBe('moderation');
    });

    it('should return overview item for unknown section ID', () => {
      const item = getSectionById(UserRole.LEADER, 'unknown-xyz');
      expect(item).toBeDefined();
      expect(item?.id).toBe('overview');
    });

    it('should return matching item metadata for Officer sections', () => {
      const item = getSectionById(UserRole.OFFICER, 'analytics');
      expect(item).toBeDefined();
      expect(item?.id).toBe('analytics');
      expect(item?.label).toBe('Phân tích & Chi tiết Khu phố');

      const leaderItem = getSectionById(UserRole.OFFICER, 'leaders');
      expect(leaderItem).toBeDefined();
      expect(leaderItem?.id).toBe('leaders');
      expect(leaderItem?.label).toBe('Quản lý Trưởng khu phố');
    });
  });

  describe('SECTION_ALIASES map', () => {
    it('should map common section variants to primary IDs', () => {
      expect(SECTION_ALIASES['pending-residents']).toBe('moderation');
      expect(SECTION_ALIASES['account-moderation']).toBe('moderation');
      expect(SECTION_ALIASES['accounts']).toBe('moderation');
      expect(SECTION_ALIASES['reports']).toBe('exports');
      expect(SECTION_ALIASES['residents']).toBe('resident-profiles');
    });
  });
});
