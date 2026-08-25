export type LocalityLevel = 'ward' | 'commune' | 'special_zone';

export interface PublicDeploymentProfileDto {
  schemaVersion: number;
  slug: string;
  localityCode: string;
  localityName: string;
  localityLevel: LocalityLevel;
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
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DeploymentProfileDto = PublicDeploymentProfileDto;

export interface DeploymentProfileResponseDto {
  initialized: boolean;
  profile: PublicDeploymentProfileDto | null;
}
