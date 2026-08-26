import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNINITIALIZED_DEPLOYMENT_KEY = 'allowUninitializedDeployment';

/**
 * Decorator to exempt specific endpoints or whole controllers from the
 * production deployment runtime readiness guard.
 *
 * Use this ONLY for endpoints that must remain accessible prior to deployment
 * initialization (e.g., deployment-profile inspection and health probes).
 */
export const AllowUninitializedDeployment = () =>
  SetMetadata(ALLOW_UNINITIALIZED_DEPLOYMENT_KEY, true);
