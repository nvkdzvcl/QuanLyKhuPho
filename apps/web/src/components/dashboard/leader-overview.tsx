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
import { UserDto } from '@quanlykhupho/shared-types';
import { useAnnouncementFeed } from '../../hooks/use-announcements';
import { usePetitions } from '../../hooks/use-petitions';
import { useResidentProfiles } from '../../hooks/use-resident-profiles';
import { getErrorMessage } from '../../lib/api-client';

export interface LeaderOverviewProps {
  user: UserDto;
  pendingResidents: UserDto[];
  isLoadingPending: boolean;
  isErrorPending: boolean;
  pendingError?: unknown;
  onApproveResident: (resident: UserDto) => void;
  onOpenRejectModal: (resident: UserDto) => void;
  onOpenLockModal: (resident: UserDto) => void;
  isApproving?: boolean;
  onNavigateSection: (sectionId: string) => void;
}

function activateWithKeyboard(
  event: React.KeyboardEvent<HTMLElement>,
  action: () => void,
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

export function LeaderOverview({
  user,
  pendingResidents,
  isLoadingPending,
  isErrorPending,
  pendingError,
  onApproveResident,
  onOpenRejectModal,
  onOpenLockModal,
  isApproving = false,
  onNavigateSection,
}: LeaderOverviewProps) {
  // Fetch real queries for stats overview
  const { data: announcementData, isLoading: isLoadingAnnouncements } =
    useAnnouncementFeed({
      neighborhoodId: user.neighborhoodId || undefined,
      limit: 5,
    });

  const { data: petitionData, isLoading: isLoadingPetitions } = usePetitions({
    neighborhoodId: user.neighborhoodId || undefined,
    limit: 5,
  });

  const { data: residentProfileData, isLoading: isLoadingProfiles } =
    useResidentProfiles(
      {
        neighborhoodId: user.neighborhoodId || undefined,
        limit: 1,
      },
      { enabled: Boolean(user.neighborhoodId) },
    );

  const pendingCount = pendingResidents.length;
  const announcementsCount = announcementData?.total ?? (isLoadingAnnouncements ? null : 0);
  const petitionsCount = petitionData?.total ?? (isLoadingPetitions ? null : 0);
  const profilesCount = residentProfileData?.total ?? (isLoadingProfiles ? null : 0);

  return (
    <div className="space-y-6">
      {/* Real-time KPI / Stat Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending Resident Registrations Card */}
        <div
          onClick={() => onNavigateSection('moderation')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) =>
            activateWithKeyboard(event, () => onNavigateSection('moderation'))
          }
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
            pendingCount > 0
              ? 'border-amber-300 bg-amber-50/70'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Hồ sơ chờ duyệt
            </span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold ${
                pendingCount > 0
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              👥
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-black text-slate-900">
              {isLoadingPending ? '...' : pendingCount}
            </div>
            {pendingCount > 0 ? (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0.5">
                Cần xử lý
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                Hoàn tất
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {pendingCount > 0
              ? `${pendingCount} cư dân đăng ký đang chờ phê duyệt`
              : 'Không có hồ sơ nào đang chờ duyệt'}
          </p>
        </div>

        {/* Resident Profiles Total */}
        <div
          onClick={() => onNavigateSection('resident-profiles')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) =>
            activateWithKeyboard(event, () =>
              onNavigateSection('resident-profiles'),
            )
          }
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Hồ sơ Cư dân
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-base font-bold">
              📑
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-black text-slate-900">
              {isLoadingProfiles ? '...' : profilesCount ?? '0'}
            </div>
            <span className="text-xs text-slate-500">nhân khẩu</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Quản lý hồ sơ cư trú và hộ khẩu khu phố
          </p>
        </div>

        {/* Announcements Total */}
        <div
          onClick={() => onNavigateSection('announcements')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) =>
            activateWithKeyboard(event, () =>
              onNavigateSection('announcements'),
            )
          }
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Bảng tin & Thông báo
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-base font-bold">
              📢
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-black text-slate-900">
              {isLoadingAnnouncements ? '...' : announcementsCount ?? '0'}
            </div>
            <span className="text-xs text-slate-500">tin đã đăng</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Thông báo khu phố và thảo luận cư dân
          </p>
        </div>

        {/* Petitions Total */}
        <div
          onClick={() => onNavigateSection('petitions')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) =>
            activateWithKeyboard(event, () => onNavigateSection('petitions'))
          }
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Kiến nghị cư dân
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 text-base font-bold">
              📬
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-black text-slate-900">
              {isLoadingPetitions ? '...' : petitionsCount ?? '0'}
            </div>
            <span className="text-xs text-slate-500">kiến nghị</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Tiếp nhận và phản hồi ý kiến người dân
          </p>
        </div>
      </div>

      {/* Primary Work Queue: Pending Resident Accounts Moderation */}
      <Card className="border-amber-200/80 shadow-md">
        <CardHeader className="bg-gradient-to-r from-amber-50/70 to-orange-50/40 border-b border-amber-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg">
                  Hàng đợi Xét duyệt Hồ sơ Cư dân
                </CardTitle>
                <Badge variant={pendingCount > 0 ? 'warning' : 'success'}>
                  {pendingCount} hồ sơ chờ
                </Badge>
              </div>
              <CardDescription className="mt-0.5">
                Cư dân tự đăng ký tài khoản qua số điện thoại thuộc {user.neighborhood?.name}.
                Cần được xét duyệt đúng địa bàn trước khi kích hoạt.
              </CardDescription>
            </div>
            {pendingCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateSection('moderation')}
                className="text-xs font-semibold text-amber-900 border-amber-300 hover:bg-amber-100/60"
              >
                Mở mục Quản lý tài khoản →
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          {isLoadingPending ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <svg
                className="animate-spin h-6 w-6 mr-2 text-amber-600"
                viewBox="0 0 24 24"
                fill="none"
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
              Đang tải danh sách hồ sơ...
            </div>
          ) : isErrorPending ? (
            <Alert
              variant="error"
              message={
                getErrorMessage(pendingError) ||
                'Không thể tải danh sách hồ sơ chờ duyệt.'
              }
            />
          ) : pendingResidents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl font-bold">
                ✓
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900">
                Hàng đợi phê duyệt đang trống
              </h4>
              <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
                Tất cả hồ sơ cư dân đăng ký vào khu phố đã được xử lý. Khi có người dân mới đăng ký,
                hồ sơ sẽ hiển thị ngay tại đây để Trưởng khu phố xét duyệt.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingResidents.map((res) => (
                <div
                  key={res.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:bg-white hover:shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900 leading-tight">
                        {res.fullName}
                      </h4>
                      <Badge variant="warning">Chờ duyệt</Badge>
                    </div>
                    <p className="text-xs text-slate-600">
                      <strong>Số điện thoại:</strong>{' '}
                      <span className="font-mono">{res.maskedPhone}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      <strong>Địa chỉ:</strong> {res.address || 'Chưa có thông tin'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Đăng ký lúc: {new Date(res.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 border-t border-slate-200 pt-3 sm:border-t-0 sm:pt-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onApproveResident(res)}
                      isLoading={isApproving}
                      className="flex-1 sm:flex-initial shadow-xs"
                    >
                      Duyệt hồ sơ
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onOpenRejectModal(res)}
                      className="flex-1 sm:flex-initial"
                    >
                      Từ chối
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenLockModal(res)}
                      className="text-xs"
                    >
                      Khóa
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Neighborhood Management Quick Navigation Shortcuts */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Lối tắt Nghiệp vụ Quản lý Khu phố
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Announcements shortcut */}
          <div
            onClick={() => onNavigateSection('announcements')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) =>
              activateWithKeyboard(event, () =>
                onNavigateSection('announcements'),
              )
            }
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg font-bold group-hover:bg-blue-600 group-hover:text-white transition">
                📢
              </div>
              <div className="min-w-0">
                <h5 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                  Bảng tin & Thông báo
                </h5>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Đăng thông báo mới, đính kèm tệp văn bản và điều hành thảo luận cư dân.
                </p>
              </div>
            </div>
          </div>

          {/* Petitions shortcut */}
          <div
            onClick={() => onNavigateSection('petitions')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) =>
              activateWithKeyboard(event, () =>
                onNavigateSection('petitions'),
              )
            }
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-purple-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 text-lg font-bold group-hover:bg-purple-600 group-hover:text-white transition">
                📬
              </div>
              <div className="min-w-0">
                <h5 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition">
                  Ý kiến & Kiến nghị
                </h5>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Tiếp nhận phản ánh hạ tầng, an ninh, vệ sinh và cập nhật kết quả xử lý.
                </p>
              </div>
            </div>
          </div>

          {/* Resident Profiles shortcut */}
          <div
            onClick={() => onNavigateSection('resident-profiles')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) =>
              activateWithKeyboard(event, () =>
                onNavigateSection('resident-profiles'),
              )
            }
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-lg font-bold group-hover:bg-emerald-600 group-hover:text-white transition">
                👥
              </div>
              <div className="min-w-0">
                <h5 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition">
                  Hồ sơ Cư dân & Hộ khẩu
                </h5>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Quản lý nhân khẩu, tra cứu độ tuổi, quan hệ chủ hộ và trích xuất danh sách.
                </p>
              </div>
            </div>
          </div>

          {/* Political & Social Profiles shortcut */}
          <div
            onClick={() => onNavigateSection('political-social')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) =>
              activateWithKeyboard(event, () =>
                onNavigateSection('political-social'),
              )
            }
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 text-lg font-bold group-hover:bg-amber-600 group-hover:text-white transition">
                🎖️
              </div>
              <div className="min-w-0">
                <h5 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition">
                  Chính trị - Xã hội
                </h5>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Hồ sơ Đảng viên, đoàn viên, các tổ chức đoàn thể và diện chính sách ưu tiên.
                </p>
              </div>
            </div>
          </div>

          {/* Neighborhood Activities shortcut */}
          <div
            onClick={() => onNavigateSection('activities')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) =>
              activateWithKeyboard(event, () =>
                onNavigateSection('activities'),
              )
            }
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 text-lg font-bold group-hover:bg-indigo-600 group-hover:text-white transition">
                📖
              </div>
              <div className="min-w-0">
                <h5 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                  Sổ hoạt động Khu phố
                </h5>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Ghi nhận phong trào, chiến dịch cộng đồng, cuộc họp và điểm danh tham gia.
                </p>
              </div>
            </div>
          </div>

          {/* Exports shortcut */}
          <div
            onClick={() => onNavigateSection('exports')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) =>
              activateWithKeyboard(event, () => onNavigateSection('exports'))
            }
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-rose-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 text-lg font-bold group-hover:bg-rose-600 group-hover:text-white transition">
                📊
              </div>
              <div className="min-w-0">
                <h5 className="text-sm font-bold text-slate-900 group-hover:text-rose-600 transition">
                  Báo cáo & Xuất dữ liệu
                </h5>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  Xuất danh sách nhân khẩu, sổ hoạt động, kiến nghị ra định dạng CSV và Excel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
