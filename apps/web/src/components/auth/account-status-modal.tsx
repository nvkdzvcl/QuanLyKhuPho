'use client';

import React from 'react';
import { Button, Modal, Badge } from '@quanlykhupho/ui';
import { AccountStatus } from '@quanlykhupho/shared-types';

interface AccountStatusModalProps {
  isOpen: boolean;
  status: AccountStatus | null;
  message?: string;
  reason?: string;
  onClose: () => void;
}

export function AccountStatusModal({
  isOpen,
  status,
  message,
  reason,
  onClose,
}: AccountStatusModalProps) {
  if (!status) return null;

  const isPending = status === AccountStatus.PENDING;
  const isRejected = status === AccountStatus.REJECTED;
  const isLocked = status === AccountStatus.LOCKED;

  const title = isPending
    ? 'Hồ sơ đang chờ phê duyệt'
    : isRejected
      ? 'Hồ sơ đã bị từ chối'
      : isLocked
        ? 'Tài khoản đã bị tạm khóa'
        : 'Thông báo trạng thái';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      footer={
        <Button variant="primary" size="md" onClick={onClose} className="w-full sm:w-auto">
          Đã hiểu & Đóng
        </Button>
      }
    >
      <div className="space-y-4 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <span className="text-sm text-slate-500">Trạng thái hiện tại:</span>
          {isPending && <Badge variant="warning">Đang chờ xét duyệt</Badge>}
          {isRejected && <Badge variant="destructive">Đã bị từ chối</Badge>}
          {isLocked && <Badge variant="destructive">Đã bị khóa</Badge>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="leading-relaxed">
            {message ||
              (isPending
                ? 'Tài khoản của bạn đã được đăng ký thành công và đang được chuyển tới Trưởng khu phố trực thuộc để đối chiếu thông tin cư trú.'
                : isRejected
                  ? 'Hồ sơ đăng ký của bạn không được Trưởng khu phố chấp thuận.'
                  : 'Tài khoản của bạn tạm thời bị khóa truy cập.')}
          </p>

          {reason && (
            <div className="mt-3 border-t border-slate-200 pt-2 text-left">
              <span className="font-semibold text-slate-900">Lý do cụ thể:</span>
              <p className="mt-1 italic text-red-700">{reason}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-blue-50/70 p-3 text-xs text-blue-800">
          <p className="font-semibold">Cần hỗ trợ?</p>
          <p className="mt-0.5">
            {isPending
              ? 'Vui lòng liên hệ trực tiếp với Trưởng khu phố / Tổ trưởng dân phố nơi bạn cư trú để được hỗ trợ phê duyệt nhanh chóng.'
              : 'Vui lòng liên hệ văn phòng Ủy ban nhân dân Phường để được giải đáp thắc mắc.'}
          </p>
        </div>
      </div>
    </Modal>
  );
}
