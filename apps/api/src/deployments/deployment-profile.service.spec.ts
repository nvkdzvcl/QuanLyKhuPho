import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentProfileService } from './deployment-profile.service';
import { DeploymentProfileController } from './deployment-profile.controller';
import { DeploymentInitializationService } from './deployment-initialization.service';
import {
  DeploymentPackage,
  parseDeploymentPackageJson,
} from './deployment-profile';
import { PrismaService } from '../prisma/prisma.service';

describe('DeploymentProfileService & Controller', () => {
  let service: DeploymentProfileService;
  let controller: DeploymentProfileController;
  let prismaService: {
    deploymentProfile: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  const mockDbProfile = {
    id: 'b7c25d88-1234-4567-89ab-cdef01234567',
    singletonKey: 'SINGLETON',
    schemaVersion: 1,
    slug: 'phuong-ben-nghe',
    localityCode: '771-01',
    localityName: 'Phường Bến Nghé',
    localityLevel: 'ward',
    provinceCode: '79',
    provinceName: 'Thành phố Hồ Chí Minh',
    districtName: 'Quận 1',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    brandName: 'UBND Phường Bến Nghé',
    supportEmail: 'ubnd.bennghe@tphcm.gov.vn',
    supportHotline: '028-38290123',
    portalUrl: 'https://bennghe.tphcm.gov.vn',
    confirmed: true,
    confirmedAt: new Date('2026-08-25T00:00:00.000Z'),
    confirmedBy: 'Admin Officer',
    createdAt: new Date('2026-08-25T00:00:00.000Z'),
    updatedAt: new Date('2026-08-25T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prismaService = {
      deploymentProfile: {
        findUnique: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentProfileController],
      providers: [
        DeploymentProfileService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<DeploymentProfileService>(DeploymentProfileService);
    controller = module.get<DeploymentProfileController>(
      DeploymentProfileController,
    );
  });

  describe('DeploymentProfileService', () => {
    it('returns initialized=false and profile=null when database is uninitialized', async () => {
      prismaService.deploymentProfile.findUnique.mockResolvedValue(null);

      const result = await service.getPublicProfile();

      expect(result).toEqual({
        initialized: false,
        profile: null,
      });
      expect(prismaService.deploymentProfile.findUnique).toHaveBeenCalledWith({
        where: { singletonKey: 'SINGLETON' },
      });
    });

    it('returns initialized=true with sanitized public profile when configured', async () => {
      prismaService.deploymentProfile.findUnique.mockResolvedValue(mockDbProfile);

      const result = await service.getPublicProfile();

      expect(result.initialized).toBe(true);
      expect(result.profile).not.toBeNull();
      expect(result.profile).toEqual({
        schemaVersion: 1,
        slug: 'phuong-ben-nghe',
        localityCode: '771-01',
        localityName: 'Phường Bến Nghé',
        localityLevel: 'ward',
        provinceCode: '79',
        provinceName: 'Thành phố Hồ Chí Minh',
        districtName: 'Quận 1',
        timezone: 'Asia/Ho_Chi_Minh',
        locale: 'vi-VN',
        brandName: 'UBND Phường Bến Nghé',
        supportEmail: 'ubnd.bennghe@tphcm.gov.vn',
        supportHotline: '028-38290123',
        portalUrl: 'https://bennghe.tphcm.gov.vn',
        confirmed: true,
        confirmedAt: '2026-08-25T00:00:00.000Z',
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z',
      });
    });

    it('strictly omits id, singletonKey, and confirmedBy from public profile DTO', async () => {
      prismaService.deploymentProfile.findUnique.mockResolvedValue(mockDbProfile);

      const result = await service.getPublicProfile();

      expect(result.profile).toBeDefined();
      const profileObj = result.profile as unknown as Record<string, unknown>;

      expect(profileObj['id']).toBeUndefined();
      expect(profileObj['singletonKey']).toBeUndefined();
      expect(profileObj['confirmedBy']).toBeUndefined();
    });

    it('handles nullable optional fields gracefully', async () => {
      const minimalDbProfile = {
        ...mockDbProfile,
        districtName: null,
        supportEmail: null,
        supportHotline: null,
        portalUrl: null,
        confirmedAt: null,
      };
      prismaService.deploymentProfile.findUnique.mockResolvedValue(
        minimalDbProfile,
      );

      const result = await service.getPublicProfile();

      expect(result.initialized).toBe(true);
      expect(result.profile?.districtName).toBeNull();
      expect(result.profile?.supportEmail).toBeNull();
      expect(result.profile?.supportHotline).toBeNull();
      expect(result.profile?.portalUrl).toBeNull();
      expect(result.profile?.confirmedAt).toBeNull();
    });
  });

  describe('DeploymentProfileController', () => {
    it('returns uninitialized state via controller GET endpoint', async () => {
      prismaService.deploymentProfile.findUnique.mockResolvedValue(null);

      const response = await controller.getDeploymentProfile();

      expect(response).toEqual({
        initialized: false,
        profile: null,
      });
    });

    it('returns configured profile state via controller GET endpoint', async () => {
      prismaService.deploymentProfile.findUnique.mockResolvedValue(mockDbProfile);

      const response = await controller.getDeploymentProfile();

      expect(response.initialized).toBe(true);
      expect(response.profile?.slug).toBe('phuong-ben-nghe');
      expect(response.profile?.localityName).toBe('Phường Bến Nghé');
    });
  });

  describe('Draft Cho Quan Deployment Package', () => {
    const choQuanPath = path.resolve(
      __dirname,
      '../../../../deployments/cho-quan/deployment.json',
    );

    it('verifies cho-quan deployment.json file exists on disk', () => {
      expect(fs.existsSync(choQuanPath)).toBe(true);
    });

    it('successfully parses cho-quan/deployment.json and verifies official metadata', () => {
      const content = fs.readFileSync(choQuanPath, 'utf-8');
      const pkg = parseDeploymentPackageJson(content);

      expect(pkg.schemaVersion).toBe(1);
      expect(pkg.slug).toBe('cho-quan');
      expect(pkg.confirmed).toBe(false);
      expect(pkg.confirmedAt).toBeUndefined();
      expect(pkg.confirmedBy).toBeUndefined();

      // Official locality invariants
      expect(pkg.locality.code).toBe('27301');
      expect(pkg.locality.name).toBe('Phường Chợ Quán');
      expect(pkg.locality.level).toBe('ward');
      expect(pkg.locality.provinceCode).toBe('79');
      expect(pkg.locality.provinceName).toBe('Thành phố Hồ Chí Minh');
      expect(pkg.locality.district).toBeUndefined(); // Legacy district must be omitted

      // Branding & settings
      expect(pkg.branding.brandName).toBe('UBND Phường Chợ Quán');
      expect(pkg.settings?.timezone).toBe('Asia/Ho_Chi_Minh');
      expect(pkg.settings?.locale).toBe('vi-VN');

      // Zero invented neighborhoods
      expect(pkg.neighborhoods).toEqual([]);
      expect(pkg.neighborhoods).toHaveLength(0);
    });

    it('validates cho-quan package in dry-run mode without database mutations', async () => {
      const mockPrisma = {
        deploymentProfile: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        neighborhood: {
          count: vi.fn().mockResolvedValue(0),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaService;

      const initService = new DeploymentInitializationService(mockPrisma);
      const pkg: DeploymentPackage = JSON.parse(
        fs.readFileSync(choQuanPath, 'utf-8'),
      );

      const result = await initService.initializeDeployment({
        package: pkg,
        apply: false,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.confirmed).toBe(false);
      expect(result.slug).toBe('cho-quan');
      expect(result.localityName).toBe('Phường Chợ Quán');
      expect(result.localityCode).toBe('27301');
      expect(result.provinceCode).toBe('79');
      expect(result.provinceName).toBe('Thành phố Hồ Chí Minh');
      expect(result.districtName).toBeNull();
      expect(result.neighborhoodsCount).toBe(0);
      expect(result.neighborhoodsCreated).toBe(0);
      expect(result.neighborhoodsUpdated).toBe(0);
    });

    it('rejects --apply for cho-quan draft package (requires confirmed=true and >=1 neighborhood)', async () => {
      const mockPrisma = {
        $transaction: vi.fn(),
      } as unknown as PrismaService;

      const initService = new DeploymentInitializationService(mockPrisma);
      const pkg: DeploymentPackage = JSON.parse(
        fs.readFileSync(choQuanPath, 'utf-8'),
      );

      await expect(
        initService.initializeDeployment({
          package: pkg,
          apply: true,
        }),
      ).rejects.toThrow(
        /Cannot apply unconfirmed\/draft deployment profile "cho-quan"/,
      );

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
