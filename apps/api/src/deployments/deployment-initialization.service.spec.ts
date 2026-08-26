import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeploymentInitializationService,
} from './deployment-initialization.service';
import {
  DeploymentPackage,
  DeploymentPackageValidationError,
  parseAndValidateDeploymentPackage,
  parseDeploymentPackageJson,
  resolveDeploymentPath,
} from './deployment-profile';

interface MockDeploymentProfile {
  id: string;
  singletonKey: string;
  schemaVersion: number;
  slug: string;
  localityCode: string;
  localityName: string;
  localityLevel: 'ward' | 'commune' | 'special_zone';
  provinceCode: string;
  provinceName: string;
  districtName: string | null;
  timezone: string;
  locale: string;
  brandName: string;
  supportEmail: string | null;
  supportHotline: string | null;
  portalUrl: string | null;
  confirmed: boolean;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockNeighborhood {
  id: string;
  code: string;
  name: string;
  ward: string;
  district: string | null;
  city: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

describe('Deployment Profile & Initialization', () => {
  const sampleValidConfirmedPackage: DeploymentPackage = {
    schemaVersion: 1,
    slug: 'phuong-ben-nghe',
    confirmed: true,
    confirmedAt: '2026-08-25T00:00:00.000Z',
    confirmedBy: 'Admin',
    locality: {
      code: '771-01',
      name: 'Phường Bến Nghé',
      level: 'ward',
      provinceCode: '79',
      provinceName: 'Thành phố Hồ Chí Minh',
      district: 'Quận 1',
    },
    branding: {
      brandName: 'UBND Phường Bến Nghé',
    },
    contact: {
      email: 'ubnd.bennghe@tphcm.gov.vn',
      hotline: '028-38290123',
      portalUrl: 'https://bennghe.tphcm.gov.vn',
    },
    settings: {
      timezone: 'Asia/Ho_Chi_Minh',
      locale: 'vi-VN',
    },
    neighborhoods: [
      {
        code: 'KP-01',
        name: 'Khu phố 1',
        description: 'Khu vực trung tâm thương mại',
      },
      {
        code: 'KP-02',
        name: 'Khu phố 2',
        description: 'Khu dân cư hiện hữu',
      },
    ],
  };

  const sampleValidDraftPackage: DeploymentPackage = {
    schemaVersion: 1,
    slug: 'cho-quan',
    confirmed: false,
    locality: {
      code: '771-02',
      name: 'Phường Chợ Quán',
      level: 'ward',
      provinceCode: '79',
      provinceName: 'Thành phố Hồ Chí Minh',
      district: 'Quận 5',
    },
    branding: {
      brandName: 'UBND Phường Chợ Quán',
    },
    neighborhoods: [
      {
        code: 'CQ-01',
        name: 'Khu phố 1',
      },
    ],
  };

  describe('Strict Package Parser & Validation', () => {
    it('successfully parses and validates a confirmed deployment package', () => {
      const parsed = parseAndValidateDeploymentPackage(sampleValidConfirmedPackage);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.slug).toBe('phuong-ben-nghe');
      expect(parsed.confirmed).toBe(true);
      expect(parsed.locality.name).toBe('Phường Bến Nghé');
      expect(parsed.neighborhoods).toHaveLength(2);
    });

    it('successfully parses and validates a draft deployment package with minimal optional fields', () => {
      const parsed = parseAndValidateDeploymentPackage(sampleValidDraftPackage);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.slug).toBe('cho-quan');
      expect(parsed.confirmed).toBe(false);
      expect(parsed.contact).toBeUndefined();
      expect(parsed.settings).toBeUndefined();
      expect(parsed.neighborhoods).toHaveLength(1);
    });

    it('rejects unknown fields at the root of the package', () => {
      const invalid = {
        ...sampleValidConfirmedPackage,
        extraUnexpectedRootKey: 'invalid',
      };
      expect(() => parseAndValidateDeploymentPackage(invalid)).toThrow(
        DeploymentPackageValidationError,
      );
      expect(() => parseAndValidateDeploymentPackage(invalid)).toThrow(
        /Unknown property "extraUnexpectedRootKey" at root/,
      );
    });

    it('rejects unknown fields inside nested objects (locality, branding, contact, settings, neighborhoods)', () => {
      const invalidLocality = {
        ...sampleValidConfirmedPackage,
        locality: {
          ...sampleValidConfirmedPackage.locality,
          inventedField: 123,
        },
      };
      expect(() => parseAndValidateDeploymentPackage(invalidLocality)).toThrow(
        /Unknown property "inventedField" at locality/,
      );

      const invalidNeighborhood = {
        ...sampleValidConfirmedPackage,
        neighborhoods: [
          {
            code: 'KP-01',
            name: 'Khu phố 1',
            unknownProp: true,
          },
        ],
      };
      expect(() => parseAndValidateDeploymentPackage(invalidNeighborhood)).toThrow(
        /Unknown property "unknownProp" at neighborhoods\[0\]/,
      );
    });

    it('rejects unsupported schemaVersion', () => {
      const invalidVersion = {
        ...sampleValidConfirmedPackage,
        schemaVersion: 2,
      };
      expect(() => parseAndValidateDeploymentPackage(invalidVersion)).toThrow(
        /Unsupported or invalid schemaVersion: 2/,
      );
    });

    it('rejects invalid slug format', () => {
      const invalidSlugs = ['Invalid_Slug', 'UPPERCASE', 'slug with space', 'slug/with/slash', '../traversal'];
      for (const slug of invalidSlugs) {
        expect(() =>
          parseAndValidateDeploymentPackage({
            ...sampleValidConfirmedPackage,
            slug,
          }),
        ).toThrow(DeploymentPackageValidationError);
      }
    });

    it('rejects invalid locality level', () => {
      const invalidLevel = {
        ...sampleValidConfirmedPackage,
        locality: {
          ...sampleValidConfirmedPackage.locality,
          level: 'province' as unknown as 'ward',
        },
      };
      expect(() => parseAndValidateDeploymentPackage(invalidLevel)).toThrow(
        /Invalid locality level/,
      );
    });

    it('rejects invalid contact details (email, hotline, portalUrl)', () => {
      expect(() =>
        parseAndValidateDeploymentPackage({
          ...sampleValidConfirmedPackage,
          contact: { email: 'not-an-email' },
        }),
      ).toThrow(/Invalid contact email/);

      expect(() =>
        parseAndValidateDeploymentPackage({
          ...sampleValidConfirmedPackage,
          contact: { hotline: 'ab' },
        }),
      ).toThrow(/Invalid contact hotline/);

      expect(() =>
        parseAndValidateDeploymentPackage({
          ...sampleValidConfirmedPackage,
          contact: { portalUrl: 'javascript:alert(1)' },
        }),
      ).toThrow(/Invalid contact portalUrl/);
    });

    it('rejects invalid settings (timezone, locale)', () => {
      expect(() =>
        parseAndValidateDeploymentPackage({
          ...sampleValidConfirmedPackage,
          settings: { timezone: 'Invalid/Timezone_Name' },
        }),
      ).toThrow(/Invalid settings timezone/);

      expect(() =>
        parseAndValidateDeploymentPackage({
          ...sampleValidConfirmedPackage,
          settings: { locale: 'invalid-locale-syntax-!@#' },
        }),
      ).toThrow(/Invalid settings locale/);
    });

    it('rejects duplicate neighborhood codes within the same package', () => {
      const duplicateCodes = {
        ...sampleValidConfirmedPackage,
        neighborhoods: [
          { code: 'KP-01', name: 'Khu phố 1' },
          { code: 'KP-01', name: 'Khu phố 2' },
        ],
      };
      expect(() => parseAndValidateDeploymentPackage(duplicateCodes)).toThrow(
        /Duplicate neighborhood code "KP-01"/,
      );
    });

    it('rejects duplicate neighborhood names within the same package', () => {
      const duplicateNames = {
        ...sampleValidConfirmedPackage,
        neighborhoods: [
          { code: 'KP-01', name: 'Khu phố 1' },
          { code: 'KP-02', name: 'Khu phố 1' },
        ],
      };
      expect(() => parseAndValidateDeploymentPackage(duplicateNames)).toThrow(
        /Duplicate neighborhood name "Khu phố 1"/,
      );
    });

    it('parses raw JSON string correctly', () => {
      const jsonStr = JSON.stringify(sampleValidConfirmedPackage);
      const parsed = parseDeploymentPackageJson(jsonStr);
      expect(parsed.slug).toBe('phuong-ben-nghe');
    });

    it('rejects malformed JSON string', () => {
      expect(() => parseDeploymentPackageJson('{ not valid json')).toThrow(
        DeploymentPackageValidationError,
      );
    });
  });

  describe('Path Resolution & Traversal Guard', () => {
    const fakeDeploymentsRoot = 'D:/QuanLyKhuPho/deployments';

    it('resolves valid slug to standard deployment.json location', () => {
      const resolved = resolveDeploymentPath(fakeDeploymentsRoot, 'cho-quan');
      expect(resolved.replace(/\\/g, '/')).toContain('/deployments/cho-quan/deployment.json');
    });

    it('rejects traversal attempts with ..', () => {
      expect(() => resolveDeploymentPath(fakeDeploymentsRoot, '../something')).toThrow(
        /Path traversal rejected/,
      );
      expect(() => resolveDeploymentPath(fakeDeploymentsRoot, '../../etc/passwd')).toThrow(
        /Path traversal rejected/,
      );
    });

    it('rejects empty or whitespace slug', () => {
      expect(() => resolveDeploymentPath(fakeDeploymentsRoot, '   ')).toThrow(
        /Profile slug or file path is required/,
      );
    });
  });

  describe('DeploymentInitializationService', () => {
    let service: DeploymentInitializationService;
    let prisma: PrismaService;

    let mockProfiles: MockDeploymentProfile[];
    let mockNeighborhoods: MockNeighborhood[];

    beforeEach(() => {
      mockProfiles = [];
      mockNeighborhoods = [];

      prisma = {
        $transaction: async <R>(
          fn: (tx: Prisma.TransactionClient) => Promise<R>,
        ): Promise<R> => fn(prisma as unknown as Prisma.TransactionClient),

        deploymentProfile: {
          findFirst: async () => mockProfiles[0] || null,
          findUnique: async ({ where }: { where: { singletonKey?: string; slug?: string } }) => {
            if (where.singletonKey) {
              return mockProfiles.find((p) => p.singletonKey === where.singletonKey) || null;
            }
            if (where.slug) {
              return mockProfiles.find((p) => p.slug === where.slug) || null;
            }
            return null;
          },
          create: async ({ data }: { data: Prisma.DeploymentProfileCreateInput }) => {
            const newProfile: MockDeploymentProfile = {
              id: 'profile-uuid-' + Date.now(),
              singletonKey: data.singletonKey || 'SINGLETON',
              schemaVersion: data.schemaVersion || 1,
              slug: data.slug,
              localityCode: data.localityCode,
              localityName: data.localityName,
              localityLevel: data.localityLevel || 'ward',
              provinceCode: data.provinceCode,
              provinceName: data.provinceName,
              districtName: data.districtName || null,
              timezone: data.timezone || 'Asia/Ho_Chi_Minh',
              locale: data.locale || 'vi-VN',
              brandName: data.brandName,
              supportEmail: data.supportEmail || null,
              supportHotline: data.supportHotline || null,
              portalUrl: data.portalUrl || null,
              confirmed: data.confirmed ?? true,
              confirmedAt: (data.confirmedAt as Date) || new Date(),
              confirmedBy: data.confirmedBy || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockProfiles.push(newProfile);
            return newProfile;
          },
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Prisma.DeploymentProfileUpdateInput;
          }) => {
            const p = mockProfiles.find((item) => item.id === where.id);
            if (!p) throw new Error('Profile not found');
            Object.assign(p, data, { updatedAt: new Date() });
            return p;
          },
        },

        neighborhood: {
          count: async () => mockNeighborhoods.length,
          findUnique: async ({
            where,
          }: {
            where: { id?: string; code?: string; ward_name?: { ward: string; name: string } };
          }) => {
            if (where.id) return mockNeighborhoods.find((n) => n.id === where.id) || null;
            if (where.code) return mockNeighborhoods.find((n) => n.code === where.code) || null;
            if (where.ward_name) {
              return (
                mockNeighborhoods.find(
                  (n) => n.ward === where.ward_name?.ward && n.name === where.ward_name?.name,
                ) || null
              );
            }
            return null;
          },
          findMany: async () => [...mockNeighborhoods],
          create: async ({ data }: { data: Prisma.NeighborhoodCreateInput }) => {
            const newN: MockNeighborhood = {
              id: 'neigh-uuid-' + (mockNeighborhoods.length + 1),
              code: data.code,
              name: data.name,
              ward: data.ward,
              district: data.district || null,
              city: data.city,
              description: data.description || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockNeighborhoods.push(newN);
            return newN;
          },
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Prisma.NeighborhoodUpdateInput;
          }) => {
            const n = mockNeighborhoods.find((item) => item.id === where.id);
            if (!n) throw new Error('Neighborhood not found');
            Object.assign(n, data, { updatedAt: new Date() });
            return n;
          },
        },
      } as unknown as PrismaService;

      service = new DeploymentInitializationService(prisma);
    });

    describe('Dry-run Mode', () => {
      it('validates draft profile in dry-run mode without errors and without writes', async () => {
        const createProfileSpy = vi.spyOn(prisma.deploymentProfile, 'create');
        const createNeighSpy = vi.spyOn(prisma.neighborhood, 'create');

        const result = await service.initializeDeployment({
          package: sampleValidDraftPackage,
          apply: false,
        });

        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(true);
        expect(result.confirmed).toBe(false);
        expect(result.slug).toBe('cho-quan');
        expect(result.localityName).toBe('Phường Chợ Quán');
        expect(result.neighborhoodsCount).toBe(1);
        expect(result.neighborhoodsCreated).toBe(0);
        expect(result.neighborhoodsUpdated).toBe(0);

        // Verify zero database writes occurred
        expect(createProfileSpy).not.toHaveBeenCalled();
        expect(createNeighSpy).not.toHaveBeenCalled();
        expect(mockProfiles).toHaveLength(0);
        expect(mockNeighborhoods).toHaveLength(0);
      });

      it('validates confirmed profile in dry-run mode with zero database writes', async () => {
        const result = await service.initializeDeployment({
          package: sampleValidConfirmedPackage,
          apply: false,
        });

        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(true);
        expect(result.confirmed).toBe(true);
        expect(result.neighborhoodsCount).toBe(2);
        expect(mockProfiles).toHaveLength(0);
        expect(mockNeighborhoods).toHaveLength(0);
      });

      it('detects locality conflict during dry-run when DB already has another locality profile', async () => {
        // Pre-populate DB with Ben Nghe
        await prisma.deploymentProfile.create({
          data: {
            singletonKey: 'SINGLETON',
            slug: 'phuong-ben-nghe',
            localityCode: '771-01',
            localityName: 'Phường Bến Nghé',
            localityLevel: 'ward',
            provinceCode: '79',
            provinceName: 'Thành phố Hồ Chí Minh',
            brandName: 'UBND Phường Bến Nghé',
            confirmed: true,
          },
        });

        // Attempt dry-run with Cho Quan
        await expect(
          service.initializeDeployment({
            package: sampleValidDraftPackage,
            apply: false,
          }),
        ).rejects.toThrow(/Locality conflict/);
      });

      it('detects neighborhood conflict during dry-run if existing code belongs to another ward', async () => {
        await prisma.deploymentProfile.create({
          data: {
            singletonKey: 'SINGLETON',
            slug: sampleValidDraftPackage.slug,
            localityCode: sampleValidDraftPackage.locality.code,
            localityName: sampleValidDraftPackage.locality.name,
            localityLevel: sampleValidDraftPackage.locality.level,
            provinceCode: sampleValidDraftPackage.locality.provinceCode,
            provinceName: sampleValidDraftPackage.locality.provinceName,
            brandName: sampleValidDraftPackage.branding.brandName,
            confirmed: true,
          },
        });
        // Pre-populate DB with KP-01 in Ben Nghe
        await prisma.neighborhood.create({
          data: {
            code: 'KP-01',
            name: 'Khu phố 1',
            ward: 'Phường Bến Nghé',
            city: 'Thành phố Hồ Chí Minh',
          },
        });

        // Package has KP-01 for Cho Quan
        const conflictingPackage: DeploymentPackage = {
          ...sampleValidDraftPackage,
          neighborhoods: [{ code: 'KP-01', name: 'Khu phố 1' }],
        };

        await expect(
          service.initializeDeployment({
            package: conflictingPackage,
            apply: false,
          }),
        ).rejects.toThrow(/Neighborhood conflict/);
      });

      it('rejects an unprofiled database that already contains legacy neighborhoods', async () => {
        await prisma.neighborhood.create({
          data: {
            code: 'LEGACY-01',
            name: 'Khu phố cũ',
            ward: 'Phường khác',
            city: 'Tỉnh khác',
          },
        });

        await expect(
          service.initializeDeployment({
            package: sampleValidDraftPackage,
            apply: false,
          }),
        ).rejects.toThrow(/Unsafe initialization rejected/);
      });
    });

    describe('Apply Mode', () => {
      it('refuses to apply unconfirmed / draft profile (requires confirmed=true)', async () => {
        await expect(
          service.initializeDeployment({
            package: sampleValidDraftPackage,
            apply: true,
          }),
        ).rejects.toThrow(/Cannot apply unconfirmed\/draft deployment profile/);

        expect(mockProfiles).toHaveLength(0);
        expect(mockNeighborhoods).toHaveLength(0);
      });

      it('refuses to apply profile with zero neighborhoods', async () => {
        const noNeighPackage: DeploymentPackage = {
          ...sampleValidConfirmedPackage,
          neighborhoods: [],
        };

        await expect(
          service.initializeDeployment({
            package: noNeighPackage,
            apply: true,
          }),
        ).rejects.toThrow(/Cannot apply deployment profile "phuong-ben-nghe" with zero neighborhoods/);
      });

      it('successfully applies confirmed profile in single transaction and creates records', async () => {
        const result = await service.initializeDeployment({
          package: sampleValidConfirmedPackage,
          apply: true,
        });

        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(false);
        expect(result.confirmed).toBe(true);
        expect(result.neighborhoodsCreated).toBe(2);
        expect(result.neighborhoodsUpdated).toBe(0);

        // Verify stored profile
        expect(mockProfiles).toHaveLength(1);
        expect(mockProfiles[0]?.slug).toBe('phuong-ben-nghe');
        expect(mockProfiles[0]?.localityName).toBe('Phường Bến Nghé');
        expect(mockProfiles[0]?.singletonKey).toBe('SINGLETON');
        expect(mockProfiles[0]?.brandName).toBe('UBND Phường Bến Nghé');

        // Verify stored neighborhoods
        expect(mockNeighborhoods).toHaveLength(2);
        expect(mockNeighborhoods.map((n) => n.code)).toEqual(['KP-01', 'KP-02']);
        expect(mockNeighborhoods[0]?.ward).toBe('Phường Bến Nghé');
        expect(mockNeighborhoods[0]?.district).toBe('Quận 1');
      });

      it('is completely idempotent when reapplying the exact same profile', async () => {
        // First apply
        const firstResult = await service.initializeDeployment({
          package: sampleValidConfirmedPackage,
          apply: true,
        });
        expect(firstResult.neighborhoodsCreated).toBe(2);
        expect(firstResult.neighborhoodsUpdated).toBe(0);

        // Second apply with updated descriptions
        const updatedPackage: DeploymentPackage = {
          ...sampleValidConfirmedPackage,
          branding: {
            brandName: 'UBND Phường Bến Nghé (Cập nhật)',
          },
          neighborhoods: [
            {
              code: 'KP-01',
              name: 'Khu phố 1',
              description: 'Mô tả mới cho KP 1',
            },
            {
              code: 'KP-02',
              name: 'Khu phố 2',
              description: 'Mô tả mới cho KP 2',
            },
          ],
        };

        const secondResult = await service.initializeDeployment({
          package: updatedPackage,
          apply: true,
        });

        expect(secondResult.success).toBe(true);
        expect(secondResult.neighborhoodsCreated).toBe(0);
        expect(secondResult.neighborhoodsUpdated).toBe(2);

        // Records not duplicated
        expect(mockProfiles).toHaveLength(1);
        expect(mockProfiles[0]?.brandName).toBe('UBND Phường Bến Nghé (Cập nhật)');
        expect(mockNeighborhoods).toHaveLength(2);
        expect(mockNeighborhoods[0]?.description).toBe('Mô tả mới cho KP 1');

        const thirdResult = await service.initializeDeployment({
          package: updatedPackage,
          apply: true,
        });
        expect(thirdResult.neighborhoodsCreated).toBe(0);
        expect(thirdResult.neighborhoodsUpdated).toBe(0);
      });

      it('rejects apply when existing database is initialized for a different locality and proves zero database writes occur', async () => {
        // Initialize for Ben Nghe
        const initialResult = await service.initializeDeployment({
          package: sampleValidConfirmedPackage,
          apply: true,
        });
        expect(initialResult.success).toBe(true);
        expect(mockProfiles).toHaveLength(1);
        expect(mockNeighborhoods).toHaveLength(2);

        // Snapshot database state before the conflicting apply
        const profileSnapshot = JSON.stringify(mockProfiles);
        const neighborhoodsSnapshot = JSON.stringify(mockNeighborhoods);

        const createProfileSpy = vi.spyOn(prisma.deploymentProfile, 'create');
        const updateProfileSpy = vi.spyOn(prisma.deploymentProfile, 'update');
        const createNeighSpy = vi.spyOn(prisma.neighborhood, 'create');
        const updateNeighSpy = vi.spyOn(prisma.neighborhood, 'update');

        // Attempt apply of confirmed Cho Quan profile (different slug, localityCode, localityName)
        const confirmedChoQuan: DeploymentPackage = {
          ...sampleValidDraftPackage,
          confirmed: true,
          confirmedAt: '2026-08-25T00:00:00.000Z',
          neighborhoods: [{ code: 'CQ-01', name: 'Khu phố 1' }],
        };

        await expect(
          service.initializeDeployment({
            package: confirmedChoQuan,
            apply: true,
          }),
        ).rejects.toThrow(/Locality conflict/);

        // Zero writes occurred during failed apply
        expect(createProfileSpy).not.toHaveBeenCalled();
        expect(updateProfileSpy).not.toHaveBeenCalled();
        expect(createNeighSpy).not.toHaveBeenCalled();
        expect(updateNeighSpy).not.toHaveBeenCalled();

        // Stored profile state is completely untouched and unchanged
        expect(mockProfiles).toHaveLength(1);
        expect(mockProfiles[0]?.slug).toBe('phuong-ben-nghe');
        expect(mockProfiles[0]?.localityCode).toBe('771-01');
        expect(mockProfiles[0]?.localityName).toBe('Phường Bến Nghé');
        expect(JSON.stringify(mockProfiles)).toBe(profileSnapshot);

        // Stored neighborhoods are completely untouched (no CQ-01, no edits to KP-01/KP-02)
        expect(mockNeighborhoods).toHaveLength(2);
        expect(mockNeighborhoods.map((n) => n.code)).toEqual(['KP-01', 'KP-02']);
        expect(JSON.stringify(mockNeighborhoods)).toBe(neighborhoodsSnapshot);
      });

      it('rejects apply when existing database profile differs in localityCode or provinceCode even with same slug', async () => {
        // Initialize for Ben Nghe
        await service.initializeDeployment({
          package: sampleValidConfirmedPackage,
          apply: true,
        });

        const profileSnapshot = JSON.stringify(mockProfiles);
        const neighborhoodsSnapshot = JSON.stringify(mockNeighborhoods);

        const createProfileSpy = vi.spyOn(prisma.deploymentProfile, 'create');
        const updateProfileSpy = vi.spyOn(prisma.deploymentProfile, 'update');
        const createNeighSpy = vi.spyOn(prisma.neighborhood, 'create');
        const updateNeighSpy = vi.spyOn(prisma.neighborhood, 'update');

        // Confirmed package with same slug but different localityCode
        const conflictingLocalityCodePackage: DeploymentPackage = {
          ...sampleValidConfirmedPackage,
          locality: {
            ...sampleValidConfirmedPackage.locality,
            code: 'DIFFERENT-CODE-999',
          },
        };

        await expect(
          service.initializeDeployment({
            package: conflictingLocalityCodePackage,
            apply: true,
          }),
        ).rejects.toThrow(/Locality conflict/);

        expect(createProfileSpy).not.toHaveBeenCalled();
        expect(updateProfileSpy).not.toHaveBeenCalled();
        expect(createNeighSpy).not.toHaveBeenCalled();
        expect(updateNeighSpy).not.toHaveBeenCalled();

        expect(JSON.stringify(mockProfiles)).toBe(profileSnapshot);
        expect(JSON.stringify(mockNeighborhoods)).toBe(neighborhoodsSnapshot);
      });

      it('rejects apply when neighborhood code exists with conflicting name', async () => {
        await prisma.deploymentProfile.create({
          data: {
            singletonKey: 'SINGLETON',
            slug: sampleValidConfirmedPackage.slug,
            localityCode: sampleValidConfirmedPackage.locality.code,
            localityName: sampleValidConfirmedPackage.locality.name,
            localityLevel: sampleValidConfirmedPackage.locality.level,
            provinceCode: sampleValidConfirmedPackage.locality.provinceCode,
            provinceName: sampleValidConfirmedPackage.locality.provinceName,
            brandName: sampleValidConfirmedPackage.branding.brandName,
            confirmed: true,
          },
        });
        // Pre-populate DB with KP-01 named "Khu phố A"
        await prisma.neighborhood.create({
          data: {
            code: 'KP-01',
            name: 'Khu phố A',
            ward: 'Phường Bến Nghé',
            city: 'Thành phố Hồ Chí Minh',
          },
        });

        // Package has KP-01 named "Khu phố 1"
        await expect(
          service.initializeDeployment({
            package: sampleValidConfirmedPackage,
            apply: true,
          }),
        ).rejects.toThrow(/Neighborhood conflict/);
      });

      it('rejects apply when neighborhood name exists in same ward under different code', async () => {
        await prisma.deploymentProfile.create({
          data: {
            singletonKey: 'SINGLETON',
            slug: sampleValidConfirmedPackage.slug,
            localityCode: sampleValidConfirmedPackage.locality.code,
            localityName: sampleValidConfirmedPackage.locality.name,
            localityLevel: sampleValidConfirmedPackage.locality.level,
            provinceCode: sampleValidConfirmedPackage.locality.provinceCode,
            provinceName: sampleValidConfirmedPackage.locality.provinceName,
            brandName: sampleValidConfirmedPackage.branding.brandName,
            confirmed: true,
          },
        });
        // Pre-populate DB with "Khu phố 1" under code "OLD-01"
        await prisma.neighborhood.create({
          data: {
            code: 'OLD-01',
            name: 'Khu phố 1',
            ward: 'Phường Bến Nghé',
            city: 'Thành phố Hồ Chí Minh',
          },
        });

        // Package has "Khu phố 1" under code "KP-01"
        await expect(
          service.initializeDeployment({
            package: sampleValidConfirmedPackage,
            apply: true,
          }),
        ).rejects.toThrow(/Neighborhood conflict/);
      });
    });
  });
});
