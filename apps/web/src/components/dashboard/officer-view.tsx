'use client';

import React, { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Select,
  Alert,
} from '@quanlykhupho/ui';
import { UserDto } from '@quanlykhupho/shared-types';
import { useNeighborhoods } from '../../hooks/use-neighborhoods';
import {
  useCreateLeader,
  usePendingResidents,
} from '../../hooks/use-pending-residents';
import { getErrorMessage } from '../../lib/api-client';

import { AnnouncementFeed } from '../announcements/announcement-feed';
import { PetitionList } from '../petitions/petition-list';
import { WardOverviewStats } from './ward-overview-stats';
import { PeriodicReportCard } from './periodic-report-card';

interface OfficerViewProps {
  user: UserDto;
}

export function OfficerView({ user }: OfficerViewProps) {
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] =
    useState<string>('');
  const { data: neighborhoods = [] } = useNeighborhoods();
  const {
    data: pendingResidents = [],
    isLoading: isLoadingPending,
    refetch,
  } = usePendingResidents(selectedNeighborhoodId || undefined);

  const createLeaderMutation = useCreateLeader();

  // Create Leader Modal state
  const [isCreateLeaderOpen, setIsCreateLeaderOpen] = useState(false);
  const [leaderPhone, setLeaderPhone] = useState('');
  const [leaderFullName, setLeaderFullName] = useState('');
  const [leaderNeighborhoodId, setLeaderNeighborhoodId] = useState('');
  const [leaderAddress, setLeaderAddress] = useState('');
  const [createLeaderError, setCreateLeaderError] = useState<string | null>(
    null,
  );
  const [toastFeedback, setToastFeedback] = useState<{
    variant: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleCreateLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLeaderError(null);

    if (!leaderPhone.trim()) {
      setCreateLeaderError('Vui lòng nhập số điện thoại Trưởng khu phố');
      return;
    }
    if (!leaderFullName.trim()) {
      setCreateLeaderError('Vui lòng nhập họ và tên');
      return;
    }
    if (!leaderNeighborhoodId) {
      setCreateLeaderError('Vui lòng chọn khu phố quản lý');
      return;
    }

    try {
      const created = await createLeaderMutation.mutateAsync({
        phoneNumber: leaderPhone.trim(),
        fullName: leaderFullName.trim(),
        neighborhoodId: leaderNeighborhoodId,
        address: leaderAddress.trim() || undefined,
      });

      setToastFeedback({
        variant: 'success',
        message: `Đã khởi tạo Trưởng khu phố "${created.fullName}" thành công. Tài khoản có hiệu lực ngay lập tức.`,
      });
      setIsCreateLeaderOpen(false);
      setLeaderPhone('');
      setLeaderFullName('');
      setLeaderNeighborhoodId('');
      setLeaderAddress('');
    } catch (err) {
      setCreateLeaderError(getErrorMessage(err));
    }
  };

  const neighborhoodOptions = neighborhoods.map((n) => ({
    value: n.id,
    label: `${n.name} (${n.code}) - ${n.ward}`,
  }));

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-900 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              Cổng Quản trị Cán bộ Phường
            </span>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              Giám sát Quản lý Toàn Phường
            </h2>
            <p className="mt-1 text-sm text-blue-100">
              Cán bộ: <strong>{user.fullName}</strong> ({user.maskedPhone}) • Phân quyền cấp Phường
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsCreateLeaderOpen(true)}
            className="shadow-sm font-semibold text-xs sm:text-sm"
          >
            + Bổ nhiệm Trưởng khu phố
          </Button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastFeedback && (
        <Alert
          variant={toastFeedback.variant}
          message={toastFeedback.message}
          onClose={() => setToastFeedback(null)}
        />
      )}

      {/* Officer-only ward overview, neighborhood drill-down and analytics */}
      <WardOverviewStats />

      {/* Officer-only periodic ward reports (FR-20) */}
      <PeriodicReportCard />

      {/* Ward Announcements Management Feed */}
      <AnnouncementFeed user={user} />

      {/* Ward Petitions Oversight & Management */}
      <PetitionList user={user} />

      {/* Ward Oversight & Pending Queue */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Hồ sơ Đăng ký chờ duyệt trên địa bàn</CardTitle>
              <CardDescription>
                Xem và theo dõi tiến độ xét duyệt cư dân của các khu phố
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Lọc theo khu phố"
                value={selectedNeighborhoodId}
                onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="">Tất cả các khu phố</option>
                {neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
                Làm mới
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoadingPending ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Đang tải danh sách hồ sơ...
            </div>
          ) : pendingResidents.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Hiện tại không có hồ sơ cư dân nào đang chờ duyệt.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingResidents.map((res) => (
                <div
                  key={res.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{res.fullName}</span>
                      <Badge variant="info">{res.neighborhood?.name || 'Khu phố'}</Badge>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      SĐT: <span className="font-mono">{res.maskedPhone}</span> • Địa chỉ: {res.address}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(res.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Leader Modal */}
      <Modal
        isOpen={isCreateLeaderOpen}
        onClose={() => setIsCreateLeaderOpen(false)}
        title="Bổ nhiệm Trưởng khu phố mới"
        description="Khởi tạo tài khoản quản trị Trưởng khu phố. Tài khoản sẽ được kích hoạt ngay lập tức."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLeader} className="space-y-4">
          {createLeaderError && (
            <Alert
              variant="error"
              message={createLeaderError}
              onClose={() => setCreateLeaderError(null)}
            />
          )}

          <Input
            label="Số điện thoại di động (10 số)"
            placeholder="Ví dụ: 0987654321"
            value={leaderPhone}
            onChange={(e) => setLeaderPhone(e.target.value)}
            required
            helperText="Dùng để đăng nhập OTP an toàn"
          />

          <Input
            label="Họ và tên Trưởng khu phố"
            placeholder="Ví dụ: Trần Văn B"
            value={leaderFullName}
            onChange={(e) => setLeaderFullName(e.target.value)}
            required
          />

          <Select
            label="Khu phố phụ trách"
            placeholder="-- Chọn khu phố quản lý --"
            options={neighborhoodOptions}
            value={leaderNeighborhoodId}
            onChange={(e) => setLeaderNeighborhoodId(e.target.value)}
            required
          />

          <Input
            label="Địa chỉ nơi ở (tùy chọn)"
            placeholder="Địa chỉ liên hệ"
            value={leaderAddress}
            onChange={(e) => setLeaderAddress(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsCreateLeaderOpen(false)}
              disabled={createLeaderMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={createLeaderMutation.isPending}
            >
              Tạo tài khoản Trưởng khu phố
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
