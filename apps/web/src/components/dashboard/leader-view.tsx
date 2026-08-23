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
  Alert,
} from '@quanlykhupho/ui';
import { UserDto } from '@quanlykhupho/shared-types';
import {
  useApproveResident,
  useLockResident,
  usePendingResidents,
  useRejectResident,
} from '../../hooks/use-pending-residents';
import { getErrorMessage } from '../../lib/api-client';

import { AnnouncementFeed } from '../announcements/announcement-feed';
import { PetitionList } from '../petitions/petition-list';
import { ResidentProfileManagement } from '../resident-profiles/resident-profile-management';

interface LeaderViewProps {
  user: UserDto;
}

export function LeaderView({ user }: LeaderViewProps) {
  const {
    data: pendingResidents = [],
    isLoading,
    isError,
    error,
    refetch,
  } = usePendingResidents();

  const approveMutation = useApproveResident();
  const rejectMutation = useRejectResident();
  const lockMutation = useLockResident();

  // Modal states
  const [rejectingResident, setRejectingResident] = useState<UserDto | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [lockingResident, setLockingResident] = useState<UserDto | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [lockError, setLockError] = useState<string | null>(null);

  const [toastFeedback, setToastFeedback] = useState<{
    variant: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleApprove = async (resident: UserDto) => {
    try {
      await approveMutation.mutateAsync(resident.id);
      setToastFeedback({
        variant: 'success',
        message: `Đã phê duyệt tài khoản cư dân "${resident.fullName}" thành công.`,
      });
    } catch (err) {
      setToastFeedback({
        variant: 'error',
        message: getErrorMessage(err),
      });
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingResident) return;
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối hồ sơ');
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        residentId: rejectingResident.id,
        dto: { reason: rejectReason.trim() },
      });
      setToastFeedback({
        variant: 'success',
        message: `Đã từ chối hồ sơ "${rejectingResident.fullName}".`,
      });
      setRejectingResident(null);
      setRejectReason('');
      setRejectError(null);
    } catch (err) {
      setRejectError(getErrorMessage(err));
    }
  };

  const handleConfirmLock = async () => {
    if (!lockingResident) return;
    if (!lockReason.trim()) {
      setLockError('Vui lòng nhập lý do khóa tài khoản');
      return;
    }

    try {
      await lockMutation.mutateAsync({
        residentId: lockingResident.id,
        dto: { reason: lockReason.trim() },
      });
      setToastFeedback({
        variant: 'success',
        message: `Đã khóa tài khoản "${lockingResident.fullName}".`,
      });
      setLockingResident(null);
      setLockReason('');
      setLockError(null);
    } catch (err) {
      setLockError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              Trang quản trị Trưởng Khu Phố
            </span>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              {user.neighborhood?.name || 'Khu phố trực thuộc'}
            </h2>
            <p className="mt-1 text-sm text-amber-100">
              Trưởng khu phố: <strong>{user.fullName}</strong> ({user.maskedPhone}) • {user.neighborhood?.ward}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 text-xs"
            >
              Làm mới dữ liệu
            </Button>
          </div>
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

      {/* Announcements Feed Section for Leader */}
      <AnnouncementFeed user={user} />

      {/* Petitions Management Section for Leader */}
      <PetitionList user={user} />

      {/* Resident Profiles Management Section for Leader */}
      <ResidentProfileManagement user={user} />

      {/* Pending Accounts Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Danh sách Cư dân chờ phê duyệt</CardTitle>
              <CardDescription>
                Hồ sơ cư dân tự đăng ký qua số điện thoại thuộc {user.neighborhood?.name}
              </CardDescription>
            </div>
            <Badge variant="warning">{pendingResidents.length} hồ sơ chờ</Badge>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <svg className="animate-spin h-6 w-6 mr-2 text-blue-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Đang tải danh sách hồ sơ...
            </div>
          ) : isError ? (
            <Alert
              variant="error"
              message={getErrorMessage(error) || 'Không thể tải danh sách hồ sơ.'}
            />
          ) : pendingResidents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xl font-bold">
                ✓
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900">
                Không có hồ sơ nào đang chờ duyệt
              </h4>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Tất cả cư dân đăng ký vào khu phố đã được xử lý. Hồ sơ mới sẽ hiển thị tại đây khi có cư dân đăng ký.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mobile Cards / Desktop List */}
              {pendingResidents.map((res) => (
                <div
                  key={res.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:bg-white hover:shadow-sm"
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
                      onClick={() => handleApprove(res)}
                      isLoading={approveMutation.isPending}
                      className="flex-1 sm:flex-initial"
                    >
                      Duyệt hồ sơ
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setRejectingResident(res);
                        setRejectReason('');
                        setRejectError(null);
                      }}
                      className="flex-1 sm:flex-initial"
                    >
                      Từ chối
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLockingResident(res);
                        setLockReason('');
                        setLockError(null);
                      }}
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

      {/* Reject Modal */}
      <Modal
        isOpen={Boolean(rejectingResident)}
        onClose={() => setRejectingResident(null)}
        title="Từ chối hồ sơ cư dân"
        description={`Bạn đang từ chối hồ sơ của cư dân: ${rejectingResident?.fullName}`}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setRejectingResident(null)}
              disabled={rejectMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={handleConfirmReject}
              isLoading={rejectMutation.isPending}
            >
              Xác nhận từ chối
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {rejectError && (
            <Alert
              variant="error"
              message={rejectError}
              onClose={() => setRejectError(null)}
            />
          )}
          <Input
            label="Lý do từ chối (bắt buộc)"
            placeholder="Ví dụ: Sai địa chỉ cư trú, không thuộc khu phố..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
            autoFocus
            helperText="Lý do từ chối sẽ được lưu trữ và thông báo tới người đăng ký qua tin nhắn SMS."
          />
        </div>
      </Modal>

      {/* Lock Modal */}
      <Modal
        isOpen={Boolean(lockingResident)}
        onClose={() => setLockingResident(null)}
        title="Khóa tài khoản cư dân"
        description={`Bạn đang khóa tài khoản của: ${lockingResident?.fullName}`}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setLockingResident(null)}
              disabled={lockMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={handleConfirmLock}
              isLoading={lockMutation.isPending}
            >
              Xác nhận khóa tài khoản
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {lockError && (
            <Alert
              variant="error"
              message={lockError}
              onClose={() => setLockError(null)}
            />
          )}
          <Input
            label="Lý do khóa tài khoản (bắt buộc)"
            placeholder="Ví dụ: Đã chuyển đi nơi khác, vi phạm quy định..."
            value={lockReason}
            onChange={(e) => setLockReason(e.target.value)}
            required
            autoFocus
            helperText="Khóa tài khoản sẽ thu hồi toàn bộ phiên đăng nhập đang hoạt động của cư dân."
          />
        </div>
      </Modal>
    </div>
  );
}
