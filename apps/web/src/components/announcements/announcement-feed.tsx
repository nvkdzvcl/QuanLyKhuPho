'use client';

import React, { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@quanlykhupho/ui';
import {
  AnnouncementDto,
  AnnouncementScope,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { useAnnouncementFeed } from '../../hooks/use-announcements';
import { useNeighborhoods } from '../../hooks/use-neighborhoods';
import { getErrorMessage } from '../../lib/api-client';
import { CreateAnnouncementModal } from './create-announcement-modal';
import { EditAnnouncementModal } from './edit-announcement-modal';
import { RemoveAnnouncementModal } from './remove-announcement-modal';
import { AnnouncementDetailModal } from './announcement-detail-modal';
import { AppIcon } from '../app-icon';

interface AnnouncementFeedProps {
  user: UserDto;
  onOpenCreate?: () => void;
}

export function AnnouncementFeed({ user }: AnnouncementFeedProps) {
  const isOfficer = user.role === UserRole.OFFICER;
  const isLeader = user.role === UserRole.LEADER;
  const canCreate = isOfficer || isLeader;

  const [scopeFilter, setScopeFilter] = useState<AnnouncementScope | undefined>(undefined);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data: neighborhoods = [] } = useNeighborhoods();

  const {
    data: feedData,
    isLoading,
    isError,
    error,
    refetch,
  } = useAnnouncementFeed({
    scope: scopeFilter,
    neighborhoodId: isOfficer && selectedNeighborhoodId ? selectedNeighborhoodId : undefined,
    search: searchTerm.trim() || undefined,
    page,
    limit: 10,
  });

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<AnnouncementDto | null>(null);
  const [removingItem, setRemovingItem] = useState<AnnouncementDto | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canManageItem = (item: AnnouncementDto) => {
    if (isOfficer) return true;
    if (isLeader && item.authorId === user.id) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toastMessage && (
        <Alert
          variant="success"
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Main Feed Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Bảng Tin & Thông Báo Khu Phố</CardTitle>
              <CardDescription>
                Cập nhật thông tin chỉ đạo, lịch sinh hoạt và tin tức cộng đồng
              </CardDescription>
            </div>
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="shrink-0 shadow-sm"
              >
                + Đăng thông báo mới
              </Button>
            )}
          </div>

          {/* Filter Chips & Search Bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-slate-100">
            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setScopeFilter(undefined);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  scopeFilter === undefined
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => {
                  setScopeFilter(AnnouncementScope.WARD);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  scopeFilter === AnnouncementScope.WARD
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <AppIcon name="globe" className="h-3.5 w-3.5" />
                <span>Toàn phường</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScopeFilter(AnnouncementScope.NEIGHBORHOOD);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  scopeFilter === AnnouncementScope.NEIGHBORHOOD
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <AppIcon name="home" className="h-3.5 w-3.5" />
                <span>{user.neighborhood?.name || 'Khu phố'}</span>
              </button>
            </div>

            {/* Officer neighborhood dropdown & Search */}
            <div className="flex flex-wrap items-center gap-2">
              {isOfficer && (
                <select
                  aria-label="Lọc theo khu phố"
                  value={selectedNeighborhoodId}
                  onChange={(e) => {
                    setSelectedNeighborhoodId(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Tất cả khu phố</option>
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="text"
                placeholder="Tìm kiếm thông báo..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-48 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
              <svg className="animate-spin h-6 w-6 mr-2 text-blue-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Đang tải danh sách thông báo...
            </div>
          ) : isError ? (
            <Alert variant="error" message={getErrorMessage(error)} />
          ) : !feedData || feedData.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <AppIcon name="megaphone" className="h-6 w-6" />
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900">
                Chưa có thông báo nào
              </h4>
              <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                Hiện tại chưa có thông báo nào trong phạm vi đã chọn. Khi có thông báo mới, thông tin sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedData.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={item.scope === AnnouncementScope.WARD ? 'info' : 'warning'}
                          className="text-[11px]"
                        >
                          <span className="flex items-center gap-1">
                            <AppIcon
                              name={item.scope === AnnouncementScope.WARD ? 'globe' : 'home'}
                              className="h-3 w-3 inline"
                            />
                            {item.scope === AnnouncementScope.WARD
                              ? 'Toàn phường'
                              : (item.neighborhood?.name || 'Khu phố')}
                          </span>
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <h3
                        onClick={() => setDetailId(item.id)}
                        className="text-base sm:text-lg font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition"
                      >
                        {item.title}
                      </h3>
                    </div>

                    {/* Manage actions if permitted */}
                    {canManageItem(item) && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingItem(item)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemovingItem(item)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-800"
                        >
                          Gỡ bỏ
                        </button>
                      </div>
                    )}
                  </div>

                  <p
                    onClick={() => setDetailId(item.id)}
                    className="mt-2.5 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed cursor-pointer"
                  >
                    {item.content}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      <span>
                        Đăng bởi: <strong>{item.author.fullName}</strong>
                      </span>
                      {item.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                          <AppIcon name="paperclip" className="h-3.5 w-3.5" />
                          <span>{item.attachments.length} tệp</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                        <AppIcon name="message-square" className="h-3.5 w-3.5" />
                        <span>{item.commentsCount} ý kiến</span>
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailId(item.id)}
                      className="text-xs"
                    >
                      Xem chi tiết & Ý kiến →
                    </Button>
                  </div>
                </div>
              ))}

              {/* Pagination controls */}
              {feedData.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Trang {feedData.page} / {feedData.totalPages} ({feedData.total} thông báo)
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
                      disabled={page >= feedData.totalPages}
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

      {/* Detail Modal */}
      {detailId && (
        <AnnouncementDetailModal
          announcementId={detailId}
          onClose={() => setDetailId(null)}
          currentUser={user}
        />
      )}

      {/* Create Modal */}
      <CreateAnnouncementModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        user={user}
        neighborhoods={neighborhoods}
        onCreated={() => {
          setToastMessage('Đăng thông báo mới thành công!');
          refetch();
        }}
      />

      {/* Edit Modal */}
      <EditAnnouncementModal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        announcement={editingItem}
        onUpdated={() => {
          setToastMessage('Cập nhật thông báo thành công!');
          setEditingItem(null);
          refetch();
        }}
      />

      {/* Remove Modal */}
      <RemoveAnnouncementModal
        isOpen={Boolean(removingItem)}
        onClose={() => setRemovingItem(null)}
        announcement={removingItem}
        onRemoved={() => {
          setToastMessage('Đã gỡ thông báo khỏi bảng tin công khai.');
          setRemovingItem(null);
          refetch();
        }}
      />
    </div>
  );
}
