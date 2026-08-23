'use client';

import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@quanlykhupho/ui';
import {
  NeighborhoodDto,
  PetitionCategory,
  PetitionDto,
  PetitionStatus,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { usePetitions } from '../../hooks/use-petitions';
import { useNeighborhoods } from '../../hooks/use-neighborhoods';
import { getErrorMessage } from '../../lib/api-client';
import { CreatePetitionModal } from './create-petition-modal';
import { PetitionDetailModal } from './petition-detail-modal';
import {
  PetitionCategoryBadge,
  PetitionStatusBadge,
} from './petition-status-badge';

interface PetitionListProps {
  user: UserDto;
  title?: string;
  description?: string;
}

const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả danh mục' },
  { value: PetitionCategory.INFRASTRUCTURE, label: '🏗️ Cơ sở hạ tầng' },
  { value: PetitionCategory.SANITATION, label: '🧹 Vệ sinh môi trường' },
  { value: PetitionCategory.SECURITY, label: '🛡️ An ninh trật tự' },
  { value: PetitionCategory.OTHER, label: '📌 Khác' },
];

export function PetitionList({ user, title, description }: PetitionListProps) {
  const isResident = user.role === UserRole.RESIDENT;
  const isOfficer = user.role === UserRole.OFFICER;

  const [statusFilter, setStatusFilter] = useState<PetitionStatus | undefined>(
    undefined,
  );
  const [categoryFilter, setCategoryFilter] = useState<
    PetitionCategory | undefined
  >(undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] =
    useState<string>('');
  const [page, setPage] = useState(1);

  const { data: neighborhoods = [] } = useNeighborhoods();

  const {
    data: petitionsData,
    isLoading,
    isError,
    error,
    refetch,
  } = usePetitions({
    status: statusFilter,
    category: categoryFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: searchTerm.trim() || undefined,
    neighborhoodId:
      isOfficer && selectedNeighborhoodId ? selectedNeighborhoodId : undefined,
    page,
    limit: 10,
  });

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPetitionId, setSelectedPetitionId] = useState<string | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleClearFilters = () => {
    setStatusFilter(undefined);
    setCategoryFilter(undefined);
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setSelectedNeighborhoodId('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <Alert
          variant="success"
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">
                {title ||
                  (isResident
                    ? 'Kiến nghị & Phản ánh của tôi'
                    : isOfficer
                    ? 'Quản lý & Giám sát Kiến nghị Toàn phường'
                    : 'Quản lý Kiến nghị Phản ánh Khu phố')}
              </CardTitle>
              <CardDescription>
                {description ||
                  (isResident
                    ? 'Theo dõi tiến trình tiếp nhận và giải quyết kiến nghị của bạn'
                    : 'Tiếp nhận, xử lý và cập nhật tiến trình giải quyết phản ánh của cư dân')}
              </CardDescription>
            </div>

            {isResident && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="shrink-0 shadow-sm"
              >
                + Gửi kiến nghị mới
              </Button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="mt-4 space-y-3 pt-3 border-t border-slate-100">
            {/* Status Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(undefined);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === undefined
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(PetitionStatus.REVIEWING);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === PetitionStatus.REVIEWING
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⏳ Chờ tiếp nhận
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(PetitionStatus.PROCESSING);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === PetitionStatus.PROCESSING
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⚙️ Đang xử lý
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(PetitionStatus.RESOLVED);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === PetitionStatus.RESOLVED
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✓ Đã giải quyết
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(PetitionStatus.REJECTED);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === PetitionStatus.REJECTED
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✕ Bị từ chối
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(PetitionStatus.CANCELLED);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === PetitionStatus.CANCELLED
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⊘ Đã hủy
              </button>
            </div>

            {/* Advanced Filters: Category, Neighborhood, Dates, Search */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              {/* Category */}
              <select
                aria-label="Lọc theo danh mục"
                value={categoryFilter || ''}
                onChange={(e) => {
                  setCategoryFilter(
                    (e.target.value as PetitionCategory) || undefined,
                  );
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
              >
                {CATEGORY_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Officer neighborhood dropdown */}
              {isOfficer && (
                <select
                  aria-label="Lọc theo khu phố"
                  value={selectedNeighborhoodId}
                  onChange={(e) => {
                    setSelectedNeighborhoodId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Tất cả khu phố</option>
                  {neighborhoods.map((n: NeighborhoodDto) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Search text */}
              <input
                type="text"
                placeholder="Tìm tiêu đề, nội dung..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
              />

              {/* Date Filters */}
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  aria-label="Từ ngày"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm"
                  title="Từ ngày"
                />
                <input
                  type="date"
                  aria-label="Đến ngày"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm"
                  title="Đến ngày"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
              <svg
                className="animate-spin h-6 w-6 mr-2 text-blue-600"
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
              Đang tải danh sách kiến nghị & phản ánh...
            </div>
          ) : isError ? (
            <div className="space-y-3">
              <Alert variant="error" message={getErrorMessage(error)} />
              <div className="text-center">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Thử lại
                </Button>
              </div>
            </div>
          ) : !petitionsData || petitionsData.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xl font-bold">
                📝
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900">
                Chưa có kiến nghị nào phù hợp
              </h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                {isResident
                  ? 'Bạn chưa gửi kiến nghị nào hoặc không có kiến nghị phù hợp với bộ lọc.'
                  : 'Hiện không có phản ánh nào cần xử lý theo tiêu chí tìm kiếm.'}
              </p>
              {(statusFilter || categoryFilter || startDate || endDate || searchTerm || selectedNeighborhoodId) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {petitionsData.items.map((item: PetitionDto) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPetitionId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPetitionId(item.id);
                    }
                  }}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:shadow-md hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <PetitionCategoryBadge category={item.category} />
                        <PetitionStatusBadge status={item.status} />
                        {!isResident && (
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            🏡 {item.neighborhood?.name || 'Khu phố'}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                        {item.title}
                      </h3>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 inline-block transition">
                        Xem chi tiết & Tiến trình →
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      <span>
                        Người gửi: <strong>{item.author.fullName}</strong>
                        {item.author.maskedPhone && (
                          <span className="font-mono text-slate-400 ml-1">
                            ({item.author.maskedPhone})
                          </span>
                        )}
                      </span>
                      {item.evidence && item.evidence.length > 0 && (
                        <span className="inline-flex items-center gap-1 font-medium text-blue-600">
                          📷 {item.evidence.length} ảnh
                        </span>
                      )}
                    </div>

                    {item.responseNote && (
                      <span className="text-[11px] text-slate-500 italic truncate max-w-xs">
                        Ghi chú: &ldquo;{item.responseNote}&rdquo;
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {petitionsData.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Trang {petitionsData.page} / {petitionsData.totalPages} ({petitionsData.total} kiến nghị)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="text-xs"
                    >
                      ← Trước
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= petitionsData.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="text-xs"
                    >
                      Sau →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      {isResident && (
        <CreatePetitionModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          user={user}
          onCreated={() => {
            setToastMessage('Đã gửi kiến nghị mới thành công!');
            refetch();
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedPetitionId && (
        <PetitionDetailModal
          petitionId={selectedPetitionId}
          onClose={() => setSelectedPetitionId(null)}
          currentUser={user}
          onStatusChanged={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
