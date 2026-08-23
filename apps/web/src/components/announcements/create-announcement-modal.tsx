'use client';

import React, { useState } from 'react';
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
} from '@quanlykhupho/ui';
import {
  AnnouncementScope,
  NeighborhoodDto,
  UserDto,
  UserRole,
} from '@quanlykhupho/shared-types';
import { useCreateAnnouncement } from '../../hooks/use-announcements';
import { getErrorMessage } from '../../lib/api-client';

interface CreateAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserDto;
  neighborhoods?: NeighborhoodDto[];
  onCreated?: () => void;
}

export function CreateAnnouncementModal({
  isOpen,
  onClose,
  user,
  neighborhoods = [],
  onCreated,
}: CreateAnnouncementModalProps) {
  const isOfficer = user.role === UserRole.OFFICER;
  const isLeader = user.role === UserRole.LEADER;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<AnnouncementScope>(
    isLeader ? AnnouncementScope.NEIGHBORHOOD : AnnouncementScope.WARD,
  );
  const [neighborhoodId, setNeighborhoodId] = useState<string>(
    user.neighborhoodId || '',
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useCreateAnnouncement();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);

    if (selectedFiles.length + incoming.length > 5) {
      setErrorMsg('Tối đa chỉ được đính kèm 5 tệp tin.');
      return;
    }

    for (const file of incoming) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg(`Tệp "${file.name}" vượt quá dung lượng 10 MiB cho phép.`);
        return;
      }
    }

    setErrorMsg(null);
    setSelectedFiles((prev) => [...prev, ...incoming]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

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

    if (scope === AnnouncementScope.NEIGHBORHOOD && isOfficer && !neighborhoodId) {
      setErrorMsg('Vui lòng chọn khu phố tiếp nhận thông báo.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        dto: {
          title: title.trim(),
          content: content.trim(),
          scope,
          neighborhoodId:
            scope === AnnouncementScope.NEIGHBORHOOD
              ? isOfficer
                ? neighborhoodId
                : user.neighborhoodId
              : null,
        },
        files: selectedFiles,
      });

      // Reset
      setTitle('');
      setContent('');
      setSelectedFiles([]);
      onClose();
      if (onCreated) onCreated();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const neighborhoodOptions = neighborhoods.map((n) => ({
    value: n.id,
    label: `${n.name} (${n.code}) - ${n.ward}`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Đăng Thông Báo Mới"
      description="Thông báo sẽ được gửi tới bảng tin và tạo thông báo trực tiếp cho cư dân trong phạm vi."
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
          placeholder="Ví dụ: Lịch họp tổ dân phố định kỳ tháng 9/2026"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />

        {/* Scope selector */}
        {isOfficer && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Phạm vi phát thông báo"
              options={[
                { value: AnnouncementScope.WARD, label: 'Toàn phường (Tất cả cư dân)' },
                { value: AnnouncementScope.NEIGHBORHOOD, label: 'Một khu phố cụ thể' },
              ]}
              value={scope}
              onChange={(e) => setScope(e.target.value as AnnouncementScope)}
              required
            />

            {scope === AnnouncementScope.NEIGHBORHOOD && (
              <Select
                label="Khu phố tiếp nhận"
                placeholder="-- Chọn khu phố --"
                options={neighborhoodOptions}
                value={neighborhoodId}
                onChange={(e) => setNeighborhoodId(e.target.value)}
                required
              />
            )}
          </div>
        )}

        {isLeader && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
            <strong>Phạm vi:</strong> Thông báo sẽ gửi tới toàn bộ cư dân thuộc{' '}
            <strong>{user.neighborhood?.name || 'Khu phố'}</strong>.
          </div>
        )}

        {/* Content Textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nội dung chi tiết <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={5}
            placeholder="Nhập nội dung đầy đủ của thông báo..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        {/* File Attachments Dropzone */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tệp đính kèm (Tối đa 5 tệp, tối đa 10 MiB/tệp)
          </label>
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center hover:bg-slate-50 transition">
            <input
              type="file"
              id="announcement-file-input"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.docx,.xlsx,.zip,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="announcement-file-input"
              className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              📎 Bấm vào đây để chọn tệp từ máy tính
            </label>
            <p className="text-[11px] text-slate-400 mt-1">
              Hỗ trợ PDF, PNG, JPG, GIF, DOCX, XLSX, ZIP, TXT (Tối đa 10 MiB)
            </p>
          </div>

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {selectedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700"
                >
                  <span className="truncate max-w-[240px] sm:max-w-xs">
                    📄 {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="text-red-500 hover:text-red-700 font-bold ml-2"
                    aria-label={`Xóa tệp ${file.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={createMutation.isPending}
          >
            Đăng thông báo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
