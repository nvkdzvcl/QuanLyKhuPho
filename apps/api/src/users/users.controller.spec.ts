import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountStatus, UserDto, UserRole } from '@quanlykhupho/shared-types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ManagedResidentQueryDto } from './dto/managed-resident-query.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getPendingResidents: ReturnType<typeof vi.fn>;
    getManagedResidents: ReturnType<typeof vi.fn>;
    approveResident: ReturnType<typeof vi.fn>;
    rejectResident: ReturnType<typeof vi.fn>;
    lockResident: ReturnType<typeof vi.fn>;
    unlockResident: ReturnType<typeof vi.fn>;
    createLeader: ReturnType<typeof vi.fn>;
  };

  const leaderUser: UserDto = {
    id: 'leader-1',
    maskedPhone: '098***1111',
    fullName: 'Trưởng Khu Phố 1',
    role: UserRole.LEADER,
    status: AccountStatus.ACTIVE,
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleResident: UserDto = {
    id: 'res-1',
    maskedPhone: '091***1111',
    fullName: 'Cư Dân 1',
    role: UserRole.RESIDENT,
    status: AccountStatus.ACTIVE,
    neighborhoodId: 'neigh-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    usersService = {
      getPendingResidents: vi.fn().mockResolvedValue([sampleResident]),
      getManagedResidents: vi.fn().mockResolvedValue([sampleResident]),
      approveResident: vi.fn().mockResolvedValue(sampleResident),
      rejectResident: vi.fn().mockResolvedValue(sampleResident),
      lockResident: vi.fn().mockResolvedValue(sampleResident),
      unlockResident: vi.fn().mockResolvedValue(sampleResident),
      createLeader: vi.fn().mockResolvedValue(leaderUser),
    };

    controller = new UsersController(usersService as unknown as UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPendingResidents', () => {
    it('delegates to usersService.getPendingResidents with currentUser and optional neighborhoodId', async () => {
      const result = await controller.getPendingResidents(leaderUser, 'neigh-1');
      expect(usersService.getPendingResidents).toHaveBeenCalledWith(
        leaderUser,
        'neigh-1',
      );
      expect(result).toEqual([sampleResident]);
    });
  });

  describe('getManagedResidents', () => {
    it('delegates to usersService.getManagedResidents with currentUser and query DTO', async () => {
      const query: ManagedResidentQueryDto = {
        status: AccountStatus.ACTIVE,
        neighborhoodId: 'neigh-1',
      };
      const result = await controller.getManagedResidents(leaderUser, query);
      expect(usersService.getManagedResidents).toHaveBeenCalledWith(
        leaderUser,
        query,
      );
      expect(result).toEqual([sampleResident]);
    });
  });

  describe('approveResident', () => {
    it('delegates to usersService.approveResident', async () => {
      const result = await controller.approveResident('res-1', leaderUser);
      expect(usersService.approveResident).toHaveBeenCalledWith(
        'res-1',
        leaderUser,
      );
      expect(result).toEqual(sampleResident);
    });
  });

  describe('rejectResident', () => {
    it('delegates to usersService.rejectResident', async () => {
      const dto = { reason: 'Sai thông tin' };
      const result = await controller.rejectResident('res-1', dto, leaderUser);
      expect(usersService.rejectResident).toHaveBeenCalledWith(
        'res-1',
        dto,
        leaderUser,
      );
      expect(result).toEqual(sampleResident);
    });
  });

  describe('lockResident', () => {
    it('delegates to usersService.lockResident', async () => {
      const dto = { reason: 'Chuyển đi nơi khác' };
      const result = await controller.lockResident('res-1', dto, leaderUser);
      expect(usersService.lockResident).toHaveBeenCalledWith(
        'res-1',
        dto,
        leaderUser,
      );
      expect(result).toEqual(sampleResident);
    });
  });

  describe('unlockResident', () => {
    it('delegates to usersService.unlockResident', async () => {
      const result = await controller.unlockResident('res-1', leaderUser);
      expect(usersService.unlockResident).toHaveBeenCalledWith(
        'res-1',
        leaderUser,
      );
      expect(result).toEqual(sampleResident);
    });
  });

  describe('createLeader', () => {
    it('delegates to usersService.createLeader', async () => {
      const dto = {
        phoneNumber: '0911222333',
        fullName: 'Trưởng Mới',
        neighborhoodId: 'neigh-1',
      };
      const result = await controller.createLeader(dto, leaderUser);
      expect(usersService.createLeader).toHaveBeenCalledWith(dto, leaderUser);
      expect(result).toEqual(leaderUser);
    });
  });
});
