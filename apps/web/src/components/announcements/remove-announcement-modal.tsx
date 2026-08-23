'use client';

import React, { useState } from 'react';
import {
  Alert,
  Button,
  Modal,
} from '@quanlykhupho/ui';
import { AnnouncementDto } from '@quanlykhupho/shared-types';
import { useRemoveAnnouncement } from '../../hooks/use-announcements';
import { getErrorMessage } from '../../lib/api-client';

interface RemoveAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: AnnouncementDto | null;
  onRemoved?: () => void;
}

export function RemoveAnnouncementModal({
  isOpen,
  onClose,
  announcement,
  onRemoved,
}: RemoveAnnouncementModalProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const removeMutation = useRemoveAnnouncement();

  if (!announcement) return null;

  const handleConfirm = async () => {
    setErrorMsg(null);
    try {
      await removeMutation.mutateAsync(announcement.id);
      onClose();
      if (onRemoved) onRemoved();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gỡ bỏ thông báo khỏi bảng tin"
      description="Thông báo này sẽ không còn hiển thị trên bảng tin công khai của cư dân. Lịch sử và bình luận vẫn được lưu trữ bảo mật cho mục đích lưu vết."
    >
      <div className="space-y-3">
        {errorMsg && (
          <Alert
            variant="error"
            message={errorMsg}
            onClose={() => setErrorMsg(null)}
          />
        )}

        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
          <p className="font-semibold text-slate-900">{announcement.title}</p>
          <p className="mt-1 text-slate-500 line-clamp-2">{announcement.content}</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={removeMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={handleConfirm}
            isLoading={removeMutation.isPending}
          >
            Xác nhận gỡ thông báo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
