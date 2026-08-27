'use client';

import React from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@quanlykhupho/ui';
import type {
  DeploymentProfileResponseDto,
  LocalityLevel,
  PublicDeploymentProfileDto,
} from '@quanlykhupho/shared-types';
import { useDeploymentProfile } from '../../hooks/use-deployment-profile';
import { getErrorMessage } from '../../lib/api-client';
import { AppIcon } from '../app-icon';

export interface DeploymentStatusCardProps {
  profileResponse?: DeploymentProfileResponseDto | null;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

const LOCALITY_LEVEL_LABELS: Record<LocalityLevel, string> = {
  ward: 'Phường',
  commune: 'Xã',
  special_zone: 'Đặc khu',
};

function formatLocalityLevel(level: LocalityLevel): string {
  return LOCALITY_LEVEL_LABELS[level] || level;
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return 'Chưa ghi nhận';
  try {
    return new Date(isoString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
}

function DetailRow({ label, value, hint }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 border-b border-slate-100 last:border-b-0">
      <dt className="text-xs font-medium text-slate-500 shrink-0 sm:w-40">
        {label}
      </dt>
      <dd className="text-xs font-semibold text-slate-900 break-words sm:text-right min-w-0 flex-1">
        {value}
        {hint && <span className="block text-[11px] font-normal text-slate-400">{hint}</span>}
      </dd>
    </div>
  );
}

export function DeploymentStatusCard({
  profileResponse: propProfileResponse,
  isLoading: propIsLoading,
  isError: propIsError,
  error: propError,
  onRetry: propOnRetry,
  className,
}: DeploymentStatusCardProps = {}) {
  const query = useDeploymentProfile();

  const isLoading = propIsLoading ?? query.isLoading;
  const isError = propIsError ?? query.isError;
  const error = propError ?? query.error;
  const data = propProfileResponse !== undefined ? propProfileResponse : query.data;
  const handleRetry = propOnRetry ?? (() => void query.refetch());

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Trạng thái Triển khai Địa bàn</CardTitle>
            <Badge variant="outline">Đang tải...</Badge>
          </div>
          <CardDescription>
            Đang truy xuất thông tin cấu hình đơn vị hành chính...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
            <svg
              className="animate-spin h-5 w-5 mr-2 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Đang kiểm tra hồ sơ triển khai...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Trạng thái Triển khai Địa bàn</CardTitle>
            <Badge variant="destructive">Lỗi tải dữ liệu</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert
            variant="error"
            title="Không thể tải hồ sơ triển khai"
            message={getErrorMessage(error) || 'Lỗi khi lấy thông tin cấu hình địa bàn từ máy chủ.'}
            action={
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Thử lại
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  if (!data?.initialized || !data.profile) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Trạng thái Triển khai Địa bàn</CardTitle>
              <CardDescription>
                Hồ sơ định danh địa bàn chưa được thiết lập trong cơ sở dữ liệu
              </CardDescription>
            </div>
            <Badge variant="warning">Chưa khởi tạo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <AppIcon name="warning" className="h-4 w-4 shrink-0 text-amber-800" />
              <span>Hệ thống đang hoạt động ở chế độ mặc định:</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              Cơ sở dữ liệu hiện tại chưa có hồ sơ cấu hình địa bàn (Deployment Profile).
              Trong môi trường phát triển, hệ thống vẫn cho phép quản trị và kiểm thử.
              Khi chuyển sang môi trường vận hành thực tế, cần hoàn tất khởi tạo và xác nhận hồ sơ địa bàn.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const profile: PublicDeploymentProfileDto = data.profile;
  const hasSupportInfo =
    Boolean(profile.supportHotline) ||
    Boolean(profile.supportEmail) ||
    Boolean(profile.portalUrl);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base sm:text-lg">
                Hồ sơ Triển khai: {profile.localityName}
              </CardTitle>
              <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {profile.localityCode}
              </span>
            </div>
            <CardDescription className="mt-1">
              Thương hiệu: <strong>{profile.brandName}</strong> • Cấp: {formatLocalityLevel(profile.localityLevel)}
            </CardDescription>
          </div>

          <div className="shrink-0">
            {profile.confirmed ? (
              <Badge variant="success" className="gap-1">
                <AppIcon name="check" className="h-3.5 w-3.5" /> Đã xác nhận chính thức
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <AppIcon name="clock" className="h-3.5 w-3.5" /> Bản nháp (Chưa xác nhận)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Verification banner if unconfirmed */}
        {!profile.confirmed && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
            <p className="font-bold text-amber-950">Lưu ý quản trị:</p>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              Hồ sơ địa bàn này đang ở trạng thái dự thảo. Trong môi trường production, các tính năng đăng nhập của người dân sẽ tạm dừng cho đến khi hồ sơ được xác nhận chính thức.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Section 1: Locality & Administrative */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Thông tin Địa phương & Đơn vị
            </h4>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Tên địa phương" value={profile.localityName} />
              <DetailRow
                label="Cấp hành chính"
                value={`${formatLocalityLevel(profile.localityLevel)} (${profile.localityLevel})`}
              />
              <DetailRow
                label="Tỉnh / Thành phố"
                value={`${profile.provinceName} (${profile.provinceCode})`}
              />
              {profile.districtName && (
                <DetailRow label="Quận / Huyện" value={profile.districtName} />
              )}
              <DetailRow
                label="Định danh hệ thống (Slug)"
                value={<span className="font-mono text-slate-800">{profile.slug}</span>}
              />
              <DetailRow label="Tên thương hiệu" value={profile.brandName} />
            </dl>
          </div>

          {/* Section 2: Runtime & Operational Config */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Cài đặt Vận hành & Thời gian
            </h4>
            <dl className="divide-y divide-slate-100">
              <DetailRow
                label="Múi giờ vận hành"
                value={<span className="font-mono">{profile.timezone}</span>}
              />
              <DetailRow
                label="Ngôn ngữ & Vùng"
                value={<span className="font-mono">{profile.locale}</span>}
              />
              <DetailRow
                label="Phiên bản sơ đồ"
                value={`v${profile.schemaVersion}`}
              />
              <DetailRow
                label="Ngày khởi tạo"
                value={formatDate(profile.createdAt)}
              />
              <DetailRow
                label="Trạng thái xác nhận"
                value={
                  profile.confirmed
                    ? `Đã xác nhận (${formatDate(profile.confirmedAt)})`
                    : 'Chưa xác nhận'
                }
              />
            </dl>
          </div>
        </div>

        {/* Section 3: Support & Contact (if provided) */}
        {hasSupportInfo && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Kênh Liên hệ & Cổng thông tin công dân
            </h4>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {profile.supportHotline && (
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <dt className="text-[11px] text-slate-500 font-medium">Hotline hỗ trợ</dt>
                  <dd className="mt-0.5 text-xs font-bold text-blue-700">
                    <a href={`tel:${profile.supportHotline}`} className="hover:underline">
                      {profile.supportHotline}
                    </a>
                  </dd>
                </div>
              )}

              {profile.supportEmail && (
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <dt className="text-[11px] text-slate-500 font-medium">Email tiếp nhận</dt>
                  <dd className="mt-0.5 text-xs font-bold text-blue-700 truncate">
                    <a href={`mailto:${profile.supportEmail}`} className="hover:underline">
                      {profile.supportEmail}
                    </a>
                  </dd>
                </div>
              )}

              {profile.portalUrl && (
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <dt className="text-[11px] text-slate-500 font-medium">Cổng thông tin</dt>
                  <dd className="mt-0.5 text-xs font-bold text-blue-700 truncate">
                    <a
                      href={profile.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {profile.portalUrl}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
