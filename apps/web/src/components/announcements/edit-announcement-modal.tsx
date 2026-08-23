'use client';

import React, { useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Input,
  Modal,
} from '@quanlykhupho/ui';
import { AnnouncementDto } from '@quanlykhupho/shared-types';
import { useUpdateAnnouncement } from '../../hooks/use-announcements';
import { getErrorMessage } from '../../lib/api-client';

interface EditAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: AnnouncementDto | null;
  onUpdated?: () => void;
}

export function EditAnnouncementModal({
  isOpen,
  onClose,
  announcement,
  onUpdated,
}: EditAnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateMutation = useUpdateAnnouncement();

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title);
      setContent(announcement.content);
      setErrorMsg(null);
    }
  }, [announcement]);

  if (!announcement) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề thông báo.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Vui lòng nhập nội dung thông báo.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: announcement.id,
        dto: {
          title: title.trim(),
          content: content.trim(),
        },
      });

      onClose();
      if (onUpdated) onUpdated();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chỉnh sửa thông báo"
      description="Cập nhật tiêu đề hoặc nội dung thông báo."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <Alert
            variant="error"
            message={errorMsg}
            onClose={() => setErrorMsg(null)}
          />
        )}

        <Input
          label="Tiêu đề thông báo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nội dung chi tiết <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={updateMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={updateMutation.isPending}
          >
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
