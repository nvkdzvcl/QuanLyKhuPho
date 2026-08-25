import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeploymentPackage,
  DeploymentPackageValidationError,
  parseAndValidateDeploymentPackage,
  parseDeploymentPackageJson,
  resolveDeploymentPath,
} from './deployment-profile';

export interface InitializeDeploymentOptions {
  package?: DeploymentPackage;
  slug?: string;
  filePath?: string;
  apply?: boolean;
  deploymentsDir?: string;
}

export interface InitializeDeploymentResult {
  success: boolean;
  dryRun: boolean;
  slug: string;
  localityCode: string;
  localityName: string;
  localityLevel: string;
  provinceCode: string;
  provinceName: string;
  districtName: string | null;
  confirmed: boolean;
  neighborhoodsCount: number;
  neighborhoodsCreated: number;
  neighborhoodsUpdated: number;
  message: string;
}

@Injectable()
export class DeploymentInitializationService {
  private readonly logger = new Logger(DeploymentInitializationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Discovers the repository root deployments directory.
   */
  getDeploymentsDirectory(customDir?: string): string {
    if (customDir && customDir.trim().length > 0) {
      return path.resolve(customDir.trim());
    }

    if (process.env.DEPLOYMENTS_DIR && process.env.DEPLOYMENTS_DIR.trim().length > 0) {
      return path.resolve(process.env.DEPLOYMENTS_DIR.trim());
    }

    // Traverse upwards from cwd and module directory looking for 'deployments' dir or repo root
    const searchDirs = [process.cwd(), __dirname];
    for (const startDir of searchDirs) {
      let currentDir = startDir;
      for (let i = 0; i < 6; i++) {
        const checkDeployments = path.join(currentDir, 'deployments');
        if (fs.existsSync(checkDeployments) && fs.statSync(checkDeployments).isDirectory()) {
          return checkDeployments;
        }
        if (
          fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml')) ||
          fs.existsSync(path.join(currentDir, 'turbo.json'))
        ) {
          return path.join(currentDir, 'deployments');
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break;
        currentDir = parentDir;
      }
    }

    // Fallback relative to current working directory
    return path.resolve(process.cwd(), 'deployments');
  }

  /**
   * Loads and strictly validates a deployment package from a file path.
   */
  loadPackageFromFile(filePath: string): DeploymentPackage {
    if (!fs.existsSync(filePath)) {
      throw new DeploymentPackageValidationError(
        `Deployment package file not found at: "${filePath}".`,
      );
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return parseDeploymentPackageJson(content);
  }

  /**
   * Loads and strictly validates a deployment package by slug or relative path.
   */
  loadPackageBySlug(
    slugOrPath: string,
    customDeploymentsDir?: string,
  ): DeploymentPackage {
    const deploymentsDir = this.getDeploymentsDirectory(customDeploymentsDir);
    const resolvedPath = resolveDeploymentPath(deploymentsDir, slugOrPath);
    return this.loadPackageFromFile(resolvedPath);
  }

  /**
   * Main entrypoint for initializing a deployment profile.
   * Dry-run by default; explicit apply=true commits to the database in a transaction.
   */
  async initializeDeployment(
    options: InitializeDeploymentOptions,
  ): Promise<InitializeDeploymentResult> {
    // 1. Resolve and validate the deployment package
    let pkg: DeploymentPackage;
    if (options.package) {
      pkg = parseAndValidateDeploymentPackage(options.package);
    } else if (options.slug) {
      pkg = this.loadPackageBySlug(options.slug, options.deploymentsDir);
    } else if (options.filePath) {
      const deploymentsDir = this.getDeploymentsDirectory(
        options.deploymentsDir,
      );
      const resolvedPath = resolveDeploymentPath(
        deploymentsDir,
        options.filePath,
      );
      pkg = this.loadPackageFromFile(resolvedPath);
    } else {
      throw new DeploymentPackageValidationError(
        'Deployment package, slug, or filePath must be specified.',
      );
    }

    const isApply = options.apply === true;

    // 2. Dry-Run Mode (Read-only verification)
    if (!isApply) {
      this.logger.log(
        `Executing dry-run validation for deployment profile "${pkg.slug}" (${pkg.locality.name})...`,
      );

      // Verify locality compatibility against existing database profile (if any)
      const existingProfile =
        await this.prisma.deploymentProfile.findUnique({
          where: { singletonKey: 'SINGLETON' },
        });
      const existingNeighborhoodCount =
        await this.prisma.neighborhood.count();
      if (!existingProfile && existingNeighborhoodCount > 0) {
        throw new Error(
          'Unsafe initialization rejected: the database already contains neighborhoods but has no deployment profile. Use a fresh database or an explicit, reviewed legacy-adoption migration.',
        );
      }
      if (existingProfile) {
        if (
          existingProfile.slug !== pkg.slug ||
          existingProfile.localityCode !== pkg.locality.code ||
          existingProfile.provinceCode !== pkg.locality.provinceCode
        ) {
          throw new Error(
            `Locality conflict: Database is already initialized for "${existingProfile.localityName}" (${existingProfile.slug}, code: ${existingProfile.localityCode}), which differs from target "${pkg.locality.name}" (${pkg.slug}, code: ${pkg.locality.code}). One database represents exactly one locality.`,
          );
        }
      }

      // Verify neighborhood compatibility against existing database neighborhoods (if any)
      for (const n of pkg.neighborhoods) {
        const existingByCode = await this.prisma.neighborhood.findUnique({
          where: { code: n.code },
        });
        if (existingByCode) {
          if (
            existingByCode.ward !== pkg.locality.name ||
            existingByCode.city !== pkg.locality.provinceName
          ) {
            throw new Error(
              `Neighborhood conflict: Existing neighborhood code "${n.code}" belongs to "${existingByCode.ward}, ${existingByCode.city}", which conflicts with target locality "${pkg.locality.name}, ${pkg.locality.provinceName}".`,
            );
          }
          if (existingByCode.name !== n.name) {
            throw new Error(
              `Neighborhood conflict: Existing neighborhood code "${n.code}" is named "${existingByCode.name}", which conflicts with package name "${n.name}".`,
            );
          }
        }

        const existingByName = await this.prisma.neighborhood.findUnique({
          where: { ward_name: { ward: pkg.locality.name, name: n.name } },
        });
        if (existingByName && existingByName.code !== n.code) {
          throw new Error(
            `Neighborhood conflict: Neighborhood named "${n.name}" already exists in ward "${pkg.locality.name}" with different code "${existingByName.code}" (package code: "${n.code}").`,
          );
        }
      }

      const statusNote = pkg.confirmed
        ? 'Package is confirmed and ready to apply with --apply.'
        : 'Package is a DRAFT (confirmed=false) and cannot be applied until verified.';

      this.logger.log(
        `Dry-run validation successful for profile "${pkg.slug}". ${statusNote}`,
      );

      return {
        success: true,
        dryRun: true,
        slug: pkg.slug,
        localityCode: pkg.locality.code,
        localityName: pkg.locality.name,
        localityLevel: pkg.locality.level,
        provinceCode: pkg.locality.provinceCode,
        provinceName: pkg.locality.provinceName,
        districtName: pkg.locality.district ?? null,
        confirmed: pkg.confirmed,
        neighborhoodsCount: pkg.neighborhoods.length,
        neighborhoodsCreated: 0,
        neighborhoodsUpdated: 0,
        message: `Dry-run validation passed for "${pkg.slug}". ${statusNote}`,
      };
    }

    // 3. Apply Mode (Transactional database write)
    if (!pkg.confirmed) {
      throw new Error(
        `Cannot apply unconfirmed/draft deployment profile "${pkg.slug}". Package must have confirmed=true to be applied to the database.`,
      );
    }

    if (pkg.neighborhoods.length === 0) {
      throw new Error(
        `Cannot apply deployment profile "${pkg.slug}" with zero neighborhoods. At least one neighborhood is required.`,
      );
    }

    this.logger.log(
      `Applying deployment profile "${pkg.slug}" (${pkg.locality.name}) to database...`,
    );

    return await this.prisma.$transaction(
      async (tx) => {
        // A. Verify / Upsert Singleton Deployment Profile
        const existingProfile =
          await tx.deploymentProfile.findUnique({
            where: { singletonKey: 'SINGLETON' },
          });
        const existingNeighborhoodCount = await tx.neighborhood.count();

        if (!existingProfile && existingNeighborhoodCount > 0) {
          throw new Error(
            'Unsafe initialization rejected: the database already contains neighborhoods but has no deployment profile. Use a fresh database or an explicit, reviewed legacy-adoption migration.',
          );
        }

        if (existingProfile) {
          if (
            existingProfile.slug !== pkg.slug ||
            existingProfile.localityCode !== pkg.locality.code ||
            existingProfile.provinceCode !== pkg.locality.provinceCode
          ) {
            throw new Error(
              `Locality conflict: Database is already initialized for "${existingProfile.localityName}" (${existingProfile.slug}), cannot apply different locality "${pkg.locality.name}" (${pkg.slug}). One database represents exactly one locality.`,
            );
          }

          // Idempotent update of profile metadata
          await tx.deploymentProfile.update({
            where: { id: existingProfile.id },
            data: {
              schemaVersion: pkg.schemaVersion,
              localityName: pkg.locality.name,
              localityLevel: pkg.locality.level,
              provinceName: pkg.locality.provinceName,
              districtName: pkg.locality.district ?? null,
              timezone: pkg.settings?.timezone ?? 'Asia/Ho_Chi_Minh',
              locale: pkg.settings?.locale ?? 'vi-VN',
              brandName: pkg.branding.brandName,
              supportEmail: pkg.contact?.email ?? null,
              supportHotline: pkg.contact?.hotline ?? null,
              portalUrl: pkg.contact?.portalUrl ?? null,
              confirmed: true,
              confirmedAt: pkg.confirmedAt
                ? new Date(pkg.confirmedAt)
                : (existingProfile.confirmedAt ?? new Date()),
              confirmedBy: pkg.confirmedBy ?? existingProfile.confirmedBy,
            },
          });
        } else {
          // Create singleton profile
          await tx.deploymentProfile.create({
            data: {
              singletonKey: 'SINGLETON',
              schemaVersion: pkg.schemaVersion,
              slug: pkg.slug,
              localityCode: pkg.locality.code,
              localityName: pkg.locality.name,
              localityLevel: pkg.locality.level,
              provinceCode: pkg.locality.provinceCode,
              provinceName: pkg.locality.provinceName,
              districtName: pkg.locality.district ?? null,
              timezone: pkg.settings?.timezone ?? 'Asia/Ho_Chi_Minh',
              locale: pkg.settings?.locale ?? 'vi-VN',
              brandName: pkg.branding.brandName,
              supportEmail: pkg.contact?.email ?? null,
              supportHotline: pkg.contact?.hotline ?? null,
              portalUrl: pkg.contact?.portalUrl ?? null,
              confirmed: true,
              confirmedAt: pkg.confirmedAt ? new Date(pkg.confirmedAt) : new Date(),
              confirmedBy: pkg.confirmedBy ?? null,
            },
          });
        }

        // B. Upsert Neighborhoods
        let createdCount = 0;
        let updatedCount = 0;

        for (const n of pkg.neighborhoods) {
          const existingByCode = await tx.neighborhood.findUnique({
            where: { code: n.code },
          });

          if (existingByCode) {
            // Conflict validation
            if (
              existingByCode.ward !== pkg.locality.name ||
              existingByCode.city !== pkg.locality.provinceName
            ) {
              throw new Error(
                `Neighborhood conflict: Existing neighborhood code "${n.code}" belongs to "${existingByCode.ward}, ${existingByCode.city}", which differs from target locality "${pkg.locality.name}, ${pkg.locality.provinceName}".`,
              );
            }
            if (existingByCode.name !== n.name) {
              throw new Error(
                `Neighborhood conflict: Existing neighborhood code "${n.code}" is named "${existingByCode.name}", which conflicts with package name "${n.name}".`,
              );
            }

            const nextDistrict = pkg.locality.district ?? null;
            const nextDescription =
              n.description !== undefined
                ? n.description
                : existingByCode.description;
            if (
              existingByCode.district !== nextDistrict ||
              existingByCode.description !== nextDescription
            ) {
              await tx.neighborhood.update({
                where: { id: existingByCode.id },
                data: {
                  district: nextDistrict,
                  description: nextDescription,
                },
              });
              updatedCount++;
            }
          } else {
            // Check for name uniqueness within same ward
            const existingByName = await tx.neighborhood.findUnique({
              where: {
                ward_name: {
                  ward: pkg.locality.name,
                  name: n.name,
                },
              },
            });

            if (existingByName) {
              throw new Error(
                `Neighborhood conflict: Neighborhood named "${n.name}" already exists in ward "${pkg.locality.name}" with different code "${existingByName.code}" (package code: "${n.code}").`,
              );
            }

            await tx.neighborhood.create({
              data: {
                code: n.code,
                name: n.name,
                ward: pkg.locality.name,
                district: pkg.locality.district ?? null,
                city: pkg.locality.provinceName,
                description: n.description ?? null,
              },
            });
            createdCount++;
          }
        }

        this.logger.log(
          `Successfully initialized deployment for "${pkg.slug}" (${createdCount} created, ${updatedCount} updated).`,
        );

        return {
          success: true,
          dryRun: false,
          slug: pkg.slug,
          localityCode: pkg.locality.code,
          localityName: pkg.locality.name,
          localityLevel: pkg.locality.level,
          provinceCode: pkg.locality.provinceCode,
          provinceName: pkg.locality.provinceName,
          districtName: pkg.locality.district ?? null,
          confirmed: true,
          neighborhoodsCount: pkg.neighborhoods.length,
          neighborhoodsCreated: createdCount,
          neighborhoodsUpdated: updatedCount,
          message: `Successfully applied deployment profile "${pkg.slug}" (${createdCount} created, ${updatedCount} updated).`,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}
