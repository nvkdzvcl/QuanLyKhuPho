import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeploymentProfileResponseDto,
  LocalityLevel,
  PublicDeploymentProfileDto,
} from '@quanlykhupho/shared-types';

@Injectable()
export class DeploymentProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the public deployment profile for the current database locality.
   * Returns { initialized: false, profile: null } if no deployment profile exists.
   * Exposes no secrets, confirmation actor, singleton key, or database internal IDs.
   */
  async getPublicProfile(): Promise<DeploymentProfileResponseDto> {
    const record = await this.prisma.deploymentProfile.findUnique({
      where: { singletonKey: 'SINGLETON' },
    });

    if (!record) {
      return {
        initialized: false,
        profile: null,
      };
    }

    const profile: PublicDeploymentProfileDto = {
      schemaVersion: record.schemaVersion,
      slug: record.slug,
      localityCode: record.localityCode,
      localityName: record.localityName,
      localityLevel: record.localityLevel as LocalityLevel,
      provinceCode: record.provinceCode,
      provinceName: record.provinceName,
      districtName: record.districtName,
      timezone: record.timezone,
      locale: record.locale,
      brandName: record.brandName,
      supportEmail: record.supportEmail,
      supportHotline: record.supportHotline,
      portalUrl: record.portalUrl,
      confirmed: record.confirmed,
      confirmedAt: record.confirmedAt ? record.confirmedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };

    return {
      initialized: true,
      profile,
    };
  }
}
