'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Modal } from '@quanlykhupho/ui';
import {
  AccountStatus,
  type ApiResponseEnvelope,
  type ResidentPhoneDto,
  type UserDto,
} from '@quanlykhupho/shared-types';
import { apiClient, getErrorMessage } from '../../lib/api-client';
import { AppIcon } from '../app-icon';

export interface ResidentAccountDetailsProps {
  resident: UserDto;
  className?: string;
}

interface AccountDetailsModalContentProps {
  resident: UserDto;
  onClose: () => void;
}

function renderStatusBadge(status: AccountStatus) {
  switch (status) {
    case AccountStatus.PENDING:
      return <Badge variant="warning">Chờ duyệt</Badge>;
    case AccountStatus.ACTIVE:
      return <Badge variant="success">Đang hoạt động</Badge>;
    case AccountStatus.LOCKED:
      return <Badge variant="destructive">Đã khóa</Badge>;
    case AccountStatus.REJECTED:
      return <Badge variant="default">Đã từ chối</Badge>;
    default:
      return <Badge variant="default">Không xác định</Badge>;
  }
}

function AccountDetailsModalContent({
  resident,
  onClose,
}: AccountDetailsModalContentProps) {
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleReveal = async () => {
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await apiClient.post<ApiResponseEnvelope<ResidentPhoneDto>>(
        `/users/${resident.id}/reveal-phone`,
        {},
        { signal: controller.signal },
      );

      if (!controller.signal.aborted) {
        setRevealedPhone(response.data.data.phoneNumber);
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setError(
          getErrorMessage(err) ||
            'Không thể hiển thị số điện thoại. Vui lòng thử lại.',
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const handleHide = () => {
    setRevealedPhone(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Account Info Card */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Họ và tên cư dân
            </span>
            <h4 className="text-base font-bold text-slate-900 leading-tight">
              {resident.fullName}
            </h4>
          </div>
          {renderStatusBadge(resident.status)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Khu phố trực thuộc:</span>
            <p className="mt-0.5 font-semibold text-slate-800">
              {resident.neighborhood?.name || 'Chưa cập nhật'}
              {resident.neighborhood?.ward
                ? ` - ${resident.neighborhood.ward}`
                : ''}
            </p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">
              Thời gian đăng ký:
            </span>
            <p className="mt-0.5 font-semibold text-slate-800">
              {new Date(resident.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-slate-500 font-medium">Địa chỉ cư trú:</span>
            <p className="mt-0.5 font-semibold text-slate-800">
              {resident.address || 'Chưa cập nhật địa chỉ'}
            </p>
          </div>
          {resident.status === AccountStatus.LOCKED && resident.lockReason && (
            <div className="sm:col-span-2 rounded-lg border border-red-100 bg-red-50/80 px-3 py-2 text-xs text-red-800">
              <span className="font-semibold">Lý do khóa:</span> {resident.lockReason}
            </div>
          )}
          {resident.status === AccountStatus.REJECTED && resident.rejectionReason && (
            <div className="sm:col-span-2 rounded-lg border border-red-100 bg-red-50/80 px-3 py-2 text-xs text-red-800">
              <span className="font-semibold">Lý do từ chối:</span> {resident.rejectionReason}
            </div>
          )}
        </div>
      </div>

      {/* Phone Number Verification Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs text-slate-500 font-medium">
              Số điện thoại:
            </span>
            <div className="mt-1 font-mono text-base font-bold text-slate-900 tracking-wide">
              {revealedPhone ? (
                <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  {revealedPhone}
                </span>
              ) : (
                <span className="text-slate-700">{resident.maskedPhone}</span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {revealedPhone ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleHide}
                className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Ẩn số điện thoại
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleReveal}
                isLoading={isLoading}
                disabled={isLoading}
                className="text-xs font-semibold shadow-xs"
              >
                Xem số điện thoại
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert
            variant="error"
            message={error}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleReveal}
                disabled={isLoading}
                className="text-xs bg-white text-red-700 border-red-200 hover:bg-red-50"
              >
                Thử lại
              </Button>
            }
          />
        )}
      </div>

      {/* Audit Log Warning Notice */}
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-900 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-amber-950">
          <AppIcon name="info" className="h-4 w-4 shrink-0 text-amber-800" />
          <span>Xác minh thông tin cư dân</span>
        </div>
        <p className="text-amber-800/90 leading-relaxed">
          Chỉ xem số điện thoại khi cần liên hệ hoặc xác minh thông tin. Hệ thống
          ghi nhận nhật ký truy cập mỗi lần xem. Đóng cửa sổ để ẩn lại số điện
          thoại.
        </p>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end pt-3 border-t border-slate-100">
        <Button
          variant="outline"
          size="md"
          onClick={onClose}
          className="text-xs sm:text-sm"
        >
          Đóng
        </Button>
      </div>
    </div>
  );
}

export function ResidentAccountDetails({
  resident,
  className,
}: ResidentAccountDetailsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`text-xs text-slate-700 border-slate-300 hover:bg-slate-50 ${className || ''}`}
      >
        Chi tiết tài khoản
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Chi tiết tài khoản"
        description="Xác minh và quản lý thông tin tài khoản cư dân"
        maxWidth="md"
      >
        {isOpen && (
          <AccountDetailsModalContent
            key={resident.id}
            resident={resident}
            onClose={() => setIsOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}
