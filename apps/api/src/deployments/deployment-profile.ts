import * as path from 'path';

export type LocalityLevel = 'ward' | 'commune' | 'special_zone';

export interface LocalityMetadata {
  code: string;
  name: string;
  level: LocalityLevel;
  provinceCode: string;
  provinceName: string;
  district?: string;
}

export interface ContactMetadata {
  email?: string;
  hotline?: string;
  portalUrl?: string;
}

export interface BrandingMetadata {
  brandName: string;
}

export interface SettingsMetadata {
  timezone?: string;
  locale?: string;
}

export interface NeighborhoodMetadata {
  code: string;
  name: string;
  description?: string | null;
}

export interface DeploymentPackage {
  schemaVersion: number;
  slug: string;
  confirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  locality: LocalityMetadata;
  contact?: ContactMetadata;
  branding: BrandingMetadata;
  settings?: SettingsMetadata;
  neighborhoods: NeighborhoodMetadata[];
}

export class DeploymentPackageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeploymentPackageValidationError';
  }
}

export function isValidSlug(slug: string): boolean {
  if (typeof slug !== 'string' || slug.length < 1 || slug.length > 100) {
    return false;
  }
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

export function isValidCode(code: string): boolean {
  if (typeof code !== 'string' || code.trim().length === 0 || code.length > 50) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(code.trim());
}

export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string' || email.length > 255) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidHotline(hotline: string): boolean {
  if (typeof hotline !== 'string' || hotline.trim().length < 3 || hotline.length > 50) {
    return false;
  }
  return /^[\d\s+\-().]{3,50}$/.test(hotline.trim());
}

export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length > 500) {
    return false;
  }
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidTimezone(tz: string): boolean {
  if (typeof tz !== 'string' || tz.trim().length === 0 || tz.length > 100) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

export function isValidLocale(loc: string): boolean {
  if (typeof loc !== 'string' || loc.trim().length === 0 || loc.length > 20) {
    return false;
  }
  try {
    const canonical = Intl.getCanonicalLocales(loc.trim());
    return canonical.length > 0;
  } catch {
    return false;
  }
}

function checkUnknownKeys(
  obj: Record<string, unknown>,
  allowedKeys: readonly string[],
  location: string,
): void {
  const allowedSet = new Set(allowedKeys);
  for (const key of Object.keys(obj)) {
    if (!allowedSet.has(key)) {
      throw new DeploymentPackageValidationError(
        `Unknown property "${key}" at ${location}.`,
      );
    }
  }
}

const ALLOWED_ROOT_KEYS = [
  'schemaVersion',
  'slug',
  'confirmed',
  'confirmedAt',
  'confirmedBy',
  'locality',
  'contact',
  'branding',
  'settings',
  'neighborhoods',
] as const;

const ALLOWED_LOCALITY_KEYS = [
  'code',
  'name',
  'level',
  'provinceCode',
  'provinceName',
  'district',
] as const;

const ALLOWED_CONTACT_KEYS = ['email', 'hotline', 'portalUrl'] as const;

const ALLOWED_BRANDING_KEYS = ['brandName'] as const;

const ALLOWED_SETTINGS_KEYS = ['timezone', 'locale'] as const;

const ALLOWED_NEIGHBORHOOD_KEYS = ['code', 'name', 'description'] as const;

export function parseAndValidateDeploymentPackage(raw: unknown): DeploymentPackage {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new DeploymentPackageValidationError(
      'Deployment package must be a JSON object.',
    );
  }

  const root = raw as Record<string, unknown>;
  checkUnknownKeys(root, ALLOWED_ROOT_KEYS, 'root');

  // 1. schemaVersion
  if (
    typeof root.schemaVersion !== 'number' ||
    !Number.isInteger(root.schemaVersion) ||
    root.schemaVersion !== 1
  ) {
    throw new DeploymentPackageValidationError(
      `Unsupported or invalid schemaVersion: ${String(root.schemaVersion)}. Expected schemaVersion=1.`,
    );
  }

  // 2. slug
  if (typeof root.slug !== 'string' || !isValidSlug(root.slug)) {
    throw new DeploymentPackageValidationError(
      `Invalid package slug: "${String(root.slug)}". Slug must be 1-100 characters of lowercase letters, numbers, and hyphens.`,
    );
  }

  // 3. confirmed
  if (typeof root.confirmed !== 'boolean') {
    throw new DeploymentPackageValidationError(
      'Property "confirmed" must be a boolean (true or false).',
    );
  }

  // 4. confirmedAt (optional)
  let confirmedAt: string | undefined;
  if (root.confirmedAt !== undefined) {
    if (
      typeof root.confirmedAt !== 'string' ||
      isNaN(Date.parse(root.confirmedAt))
    ) {
      throw new DeploymentPackageValidationError(
        'Property "confirmedAt" must be a valid ISO-8601 date string if provided.',
      );
    }
    confirmedAt = root.confirmedAt;
  }

  // 5. confirmedBy (optional)
  let confirmedBy: string | undefined;
  if (root.confirmedBy !== undefined) {
    if (
      typeof root.confirmedBy !== 'string' ||
      root.confirmedBy.trim().length === 0 ||
      root.confirmedBy.length > 255
    ) {
      throw new DeploymentPackageValidationError(
        'Property "confirmedBy" must be a non-empty string under 255 characters if provided.',
      );
    }
    confirmedBy = root.confirmedBy.trim();
  }

  // 6. locality
  if (
    typeof root.locality !== 'object' ||
    root.locality === null ||
    Array.isArray(root.locality)
  ) {
    throw new DeploymentPackageValidationError(
      'Property "locality" must be an object.',
    );
  }

  const localityObj = root.locality as Record<string, unknown>;
  checkUnknownKeys(localityObj, ALLOWED_LOCALITY_KEYS, 'locality');

  if (
    typeof localityObj.code !== 'string' ||
    !isValidCode(localityObj.code)
  ) {
    throw new DeploymentPackageValidationError(
      'Locality "code" is required and must be alphanumeric/hyphen/underscore (1-50 chars).',
    );
  }

  if (
    typeof localityObj.name !== 'string' ||
    localityObj.name.trim().length === 0 ||
    localityObj.name.length > 255
  ) {
    throw new DeploymentPackageValidationError(
      'Locality "name" is required and must be 1-255 characters.',
    );
  }

  if (
    localityObj.level !== 'ward' &&
    localityObj.level !== 'commune' &&
    localityObj.level !== 'special_zone'
  ) {
    throw new DeploymentPackageValidationError(
      `Invalid locality level: "${String(localityObj.level)}". Must be one of: ward, commune, special_zone.`,
    );
  }

  if (
    typeof localityObj.provinceCode !== 'string' ||
    !isValidCode(localityObj.provinceCode)
  ) {
    throw new DeploymentPackageValidationError(
      'Locality "provinceCode" is required and must be alphanumeric/hyphen/underscore (1-50 chars).',
    );
  }

  if (
    typeof localityObj.provinceName !== 'string' ||
    localityObj.provinceName.trim().length === 0 ||
    localityObj.provinceName.length > 255
  ) {
    throw new DeploymentPackageValidationError(
      'Locality "provinceName" is required and must be 1-255 characters.',
    );
  }

  let localityDistrict: string | undefined;
  if (localityObj.district !== undefined) {
    if (
      typeof localityObj.district !== 'string' ||
      localityObj.district.trim().length === 0 ||
      localityObj.district.length > 255
    ) {
      throw new DeploymentPackageValidationError(
        'Locality "district" must be a non-empty string (1-255 chars) if provided.',
      );
    }
    localityDistrict = localityObj.district.trim();
  }

  const locality: LocalityMetadata = {
    code: localityObj.code.trim(),
    name: localityObj.name.trim(),
    level: localityObj.level as LocalityLevel,
    provinceCode: localityObj.provinceCode.trim(),
    provinceName: localityObj.provinceName.trim(),
    district: localityDistrict,
  };

  // 7. branding
  if (
    typeof root.branding !== 'object' ||
    root.branding === null ||
    Array.isArray(root.branding)
  ) {
    throw new DeploymentPackageValidationError(
      'Property "branding" must be an object.',
    );
  }

  const brandingObj = root.branding as Record<string, unknown>;
  checkUnknownKeys(brandingObj, ALLOWED_BRANDING_KEYS, 'branding');

  if (
    typeof brandingObj.brandName !== 'string' ||
    brandingObj.brandName.trim().length === 0 ||
    brandingObj.brandName.length > 255
  ) {
    throw new DeploymentPackageValidationError(
      'Branding "brandName" is required and must be 1-255 characters.',
    );
  }

  const branding: BrandingMetadata = {
    brandName: brandingObj.brandName.trim(),
  };

  // 8. contact (optional)
  let contact: ContactMetadata | undefined;
  if (root.contact !== undefined) {
    if (
      typeof root.contact !== 'object' ||
      root.contact === null ||
      Array.isArray(root.contact)
    ) {
      throw new DeploymentPackageValidationError(
        'Property "contact" must be an object if provided.',
      );
    }
    const contactObj = root.contact as Record<string, unknown>;
    checkUnknownKeys(contactObj, ALLOWED_CONTACT_KEYS, 'contact');

    let email: string | undefined;
    if (contactObj.email !== undefined) {
      if (
        typeof contactObj.email !== 'string' ||
        !isValidEmail(contactObj.email)
      ) {
        throw new DeploymentPackageValidationError(
          `Invalid contact email: "${String(contactObj.email)}".`,
        );
      }
      email = contactObj.email.trim();
    }

    let hotline: string | undefined;
    if (contactObj.hotline !== undefined) {
      if (
        typeof contactObj.hotline !== 'string' ||
        !isValidHotline(contactObj.hotline)
      ) {
        throw new DeploymentPackageValidationError(
          `Invalid contact hotline: "${String(contactObj.hotline)}".`,
        );
      }
      hotline = contactObj.hotline.trim();
    }

    let portalUrl: string | undefined;
    if (contactObj.portalUrl !== undefined) {
      if (
        typeof contactObj.portalUrl !== 'string' ||
        !isValidUrl(contactObj.portalUrl)
      ) {
        throw new DeploymentPackageValidationError(
          `Invalid contact portalUrl: "${String(contactObj.portalUrl)}". Must be a valid http or https URL.`,
        );
      }
      portalUrl = contactObj.portalUrl.trim();
    }

    contact = { email, hotline, portalUrl };
  }

  // 9. settings (optional)
  let settings: SettingsMetadata | undefined;
  if (root.settings !== undefined) {
    if (
      typeof root.settings !== 'object' ||
      root.settings === null ||
      Array.isArray(root.settings)
    ) {
      throw new DeploymentPackageValidationError(
        'Property "settings" must be an object if provided.',
      );
    }
    const settingsObj = root.settings as Record<string, unknown>;
    checkUnknownKeys(settingsObj, ALLOWED_SETTINGS_KEYS, 'settings');

    let timezone: string | undefined;
    if (settingsObj.timezone !== undefined) {
      if (
        typeof settingsObj.timezone !== 'string' ||
        !isValidTimezone(settingsObj.timezone)
      ) {
        throw new DeploymentPackageValidationError(
          `Invalid settings timezone: "${String(settingsObj.timezone)}". Must be a valid IANA timezone name.`,
        );
      }
      timezone = settingsObj.timezone.trim();
    }

    let locale: string | undefined;
    if (settingsObj.locale !== undefined) {
      if (
        typeof settingsObj.locale !== 'string' ||
        !isValidLocale(settingsObj.locale)
      ) {
        throw new DeploymentPackageValidationError(
          `Invalid settings locale: "${String(settingsObj.locale)}". Must be a valid BCP 47 locale.`,
        );
      }
      locale = settingsObj.locale.trim();
    }

    settings = { timezone, locale };
  }

  // 10. neighborhoods
  if (!Array.isArray(root.neighborhoods)) {
    throw new DeploymentPackageValidationError(
      'Property "neighborhoods" must be an array.',
    );
  }

  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();
  const neighborhoods: NeighborhoodMetadata[] = [];

  for (let i = 0; i < root.neighborhoods.length; i++) {
    const item = root.neighborhoods[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new DeploymentPackageValidationError(
        `Neighborhood at index ${i} must be an object.`,
      );
    }

    const nObj = item as Record<string, unknown>;
    checkUnknownKeys(nObj, ALLOWED_NEIGHBORHOOD_KEYS, `neighborhoods[${i}]`);

    if (typeof nObj.code !== 'string' || !isValidCode(nObj.code)) {
      throw new DeploymentPackageValidationError(
        `Neighborhood at index ${i} has invalid code "${String(nObj.code)}". Code must be alphanumeric/hyphen/underscore (1-50 chars).`,
      );
    }
    const normalizedCode = nObj.code.trim();
    if (seenCodes.has(normalizedCode.toLowerCase())) {
      throw new DeploymentPackageValidationError(
        `Duplicate neighborhood code "${normalizedCode}" found in package.`,
      );
    }
    seenCodes.add(normalizedCode.toLowerCase());

    if (
      typeof nObj.name !== 'string' ||
      nObj.name.trim().length === 0 ||
      nObj.name.length > 255
    ) {
      throw new DeploymentPackageValidationError(
        `Neighborhood at index ${i} has invalid name. Name must be 1-255 characters.`,
      );
    }
    const normalizedName = nObj.name.trim();
    if (seenNames.has(normalizedName.toLowerCase())) {
      throw new DeploymentPackageValidationError(
        `Duplicate neighborhood name "${normalizedName}" found in package.`,
      );
    }
    seenNames.add(normalizedName.toLowerCase());

    let description: string | null | undefined;
    if (nObj.description !== undefined && nObj.description !== null) {
      if (typeof nObj.description !== 'string') {
        throw new DeploymentPackageValidationError(
          `Neighborhood "${normalizedCode}" description must be a string or null if provided.`,
        );
      }
      description = nObj.description.trim();
    } else if (nObj.description === null) {
      description = null;
    }

    neighborhoods.push({
      code: normalizedCode,
      name: normalizedName,
      description,
    });
  }

  return {
    schemaVersion: root.schemaVersion,
    slug: root.slug,
    confirmed: root.confirmed,
    confirmedAt,
    confirmedBy,
    locality,
    contact,
    branding,
    settings,
    neighborhoods,
  };
}

export function parseDeploymentPackageJson(jsonString: string): DeploymentPackage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new DeploymentPackageValidationError(
      `Failed to parse deployment package JSON: ${errorMsg}`,
    );
  }
  return parseAndValidateDeploymentPackage(parsed);
}

export function resolveDeploymentPath(
  deploymentsRoot: string,
  inputSlugOrPath: string,
): string {
  if (
    typeof inputSlugOrPath !== 'string' ||
    inputSlugOrPath.trim().length === 0
  ) {
    throw new DeploymentPackageValidationError(
      'Profile slug or file path is required.',
    );
  }

  const trimmed = inputSlugOrPath.trim();

  // Reject explicit traversal attempts
  if (trimmed.includes('..') || trimmed.includes('\0')) {
    throw new DeploymentPackageValidationError(
      `Path traversal rejected: "${trimmed}".`,
    );
  }

  const normalizedRoot = path.resolve(deploymentsRoot);

  let targetPath: string;
  if (isValidSlug(trimmed)) {
    targetPath = path.join(normalizedRoot, trimmed, 'deployment.json');
  } else {
    targetPath = path.isAbsolute(trimmed)
      ? path.normalize(trimmed)
      : path.resolve(normalizedRoot, trimmed);
  }

  const relative = path.relative(normalizedRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new DeploymentPackageValidationError(
      `Target file "${trimmed}" resolves outside the deployments directory: "${targetPath}".`,
    );
  }

  return targetPath;
}
