import { describe, it, expect } from 'vitest';
import {
  PetitionCategory,
  PetitionDetailDto,
  PetitionDto,
  PetitionStatus,
  UserRole,
} from '@quanlykhupho/shared-types';

describe('Web Petitions Contracts & Workflow', () => {
  it('should conform to PetitionDto and PetitionDetailDto contracts', () => {
    const petition: PetitionDto = {
      id: 'pet-123',
      title: 'Hỏng đèn chiếu sáng công cộng',
      description: 'Đèn đường trước ngõ 45 bị hỏng từ tuần trước...',
      category: PetitionCategory.INFRASTRUCTURE,
      status: PetitionStatus.REVIEWING,
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
      authorId: 'resident-1',
      author: {
        id: 'resident-1',
        fullName: 'Nguyễn Văn Cư Dân',
        role: UserRole.RESIDENT,
        maskedPhone: '090***1234',
        address: '45 Lê Lợi',
      },
      evidence: [
        {
          id: 'ev-1',
          petitionId: 'pet-123',
          fileName: 'lamp.jpg',
          originalName: 'den_hong.jpg',
          mimeType: 'image/jpeg',
          fileSize: 204800,
          createdAt: new Date().toISOString(),
        },
      ],
      latestHistory: {
        id: 'hist-1',
        petitionId: 'pet-123',
        fromStatus: null,
        toStatus: PetitionStatus.REVIEWING,
        changedById: 'resident-1',
        note: 'Tạo kiến nghị mới',
        createdAt: new Date().toISOString(),
      },
      responseNote: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(petition.category).toBe(PetitionCategory.INFRASTRUCTURE);
    expect(petition.status).toBe(PetitionStatus.REVIEWING);
    expect(petition.evidence.length).toBe(1);
    expect(petition.author.maskedPhone).toBe('090***1234');

    const petitionDetail: PetitionDetailDto = {
      ...petition,
      history: [
        petition.latestHistory!,
        {
          id: 'hist-2',
          petitionId: 'pet-123',
          fromStatus: PetitionStatus.REVIEWING,
          toStatus: PetitionStatus.PROCESSING,
          changedById: 'leader-1',
          changedBy: {
            id: 'leader-1',
            fullName: 'Trần Văn Trưởng',
            role: UserRole.LEADER,
            maskedPhone: '091***5678',
          },
          note: 'Đã báo đơn vị chiếu sáng',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    expect(petitionDetail.history.length).toBe(2);
    expect(petitionDetail.history[1]?.toStatus).toBe(PetitionStatus.PROCESSING);
  });
});
