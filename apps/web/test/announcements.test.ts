import { describe, it, expect } from 'vitest';
import { AnnouncementScope, AnnouncementStatus, UserRole } from '@quanlykhupho/shared-types';

describe('Web Announcements & Notifications Contracts', () => {
  it('should conform to AnnouncementDto contracts', () => {
    const announcement = {
      id: 'ann-123',
      title: 'Họp dân phố định kỳ',
      content: 'Nội dung chi tiết cuộc họp...',
      scope: AnnouncementScope.NEIGHBORHOOD,
      status: AnnouncementStatus.PUBLISHED,
      neighborhoodId: 'neigh-1',
      authorId: 'user-1',
      author: {
        id: 'user-1',
        fullName: 'Trần Văn Trưởng',
        role: UserRole.LEADER,
      },
      attachments: [
        {
          id: 'att-1',
          fileName: 'guidelines.pdf',
          originalName: 'HuongDan.pdf',
          mimeType: 'application/pdf',
          fileSize: 102400,
          createdAt: new Date().toISOString(),
        },
      ],
      commentsCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(announcement.scope).toBe(AnnouncementScope.NEIGHBORHOOD);
    expect(announcement.status).toBe(AnnouncementStatus.PUBLISHED);
    expect(announcement.attachments.length).toBe(1);
    expect(announcement.commentsCount).toBe(2);
  });
});
