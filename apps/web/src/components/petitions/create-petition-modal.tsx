'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
} from '@quanlykhupho/ui';
import {
  CreatePetitionDto,
  PetitionCategory,
  UserDto,
} from '@quanlykhupho/shared-types';
import { useCreatePetition } from '../../hooks/use-petitions';
import { getErrorMessage } from '../../lib/api-client';
import { AppIcon } from '../app-icon';

interface CreatePetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserDto;
  onCreated?: () => void;
}

const CATEGORY_OPTIONS = [
  { value: PetitionCategory.INFRASTRUCTURE, label: 'Cơ sở hạ tầng (Đường sá, điện, nước, công trình)' },
  { value: PetitionCategory.SANITATION, label: 'Vệ sinh môi trường (Rác thải, cống rãnh, ô nhiễm)' },
  { value: PetitionCategory.SECURITY, label: 'An ninh trật tự (Tiếng ồn, lấn chiếm, an toàn)' },
  { value: PetitionCategory.OTHER, label: 'Khác (Ý kiến & đóng góp chung)' },
];

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB

export function CreatePetitionModal({
  isOpen,
  onClose,
  user,
  onCreated,
}: CreatePetitionModalProps) {
  const createMutation = useCreatePetition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PetitionCategory>(PetitionCategory.INFRASTRUCTURE);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ name: string; size: number; url: string }[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filePreviewsRef = useRef<{ name: string; size: number; url: string }[]>([]);
  filePreviewsRef.current = filePreviews;

  const resetForm = useCallback(() => {
    filePreviewsRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    setTitle('');
    setDescription('');
    setCategory(PetitionCategory.INFRASTRUCTURE);
    setSelectedFiles([]);
    setFilePreviews([]);
    setErrorMessage(null);
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      filePreviewsRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  // Reset form and revoke object URLs when modal is closed
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    if (selectedFiles.length + files.length > MAX_FILES) {
      setErrorMessage(`Bạn chỉ được đính kèm tối đa ${MAX_FILES} hình ảnh minh chứng.`);
      e.target.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];

    // Validate the entire batch first before creating any object URLs
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage(`Hình ảnh "${file.name}" vượt quá giới hạn 10 MiB cho phép.`);
        e.target.value = '';
        return;
      }

      if (!validTypes.includes(file.type.toLowerCase())) {
        setErrorMessage(`Tệp "${file.name}" không đúng định dạng. Chỉ chấp nhận hình ảnh JPEG, PNG, hoặc WebP.`);
        e.target.value = '';
        return;
      }
    }

    // All files in the batch are valid; create object URLs
    const newPreviews = files.map((file) => ({
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
    }));

    setErrorMessage(null);
    setSelectedFiles((prev) => [...prev, ...files]);
    setFilePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Vui lòng nhập tiêu đề kiến nghị.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Vui lòng nhập nội dung chi tiết kiến nghị.');
      return;
    }

    const dto: CreatePetitionDto = {
      title: title.trim(),
      description: description.trim(),
      category,
    };

    try {
      await createMutation.mutateAsync({
        dto,
        files: selectedFiles.length > 0 ? selectedFiles : undefined,
      });

      resetForm();

      if (onCreated) {
        onCreated();
      }
      onClose();
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Gửi Kiến nghị & Phản ánh Mới"
      description={`Kiến nghị sẽ được gửi trực tiếp tới Ban Quản Trị ${user.neighborhood?.name || 'Khu phố'} để tiếp nhận và giải quyết.`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <Alert
            variant="error"
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}

        <Input
          label="Tiêu đề kiến nghị / phản ánh"
          placeholder="Ví dụ: Cống thoát nước bị nghẹt gây ngập đường số 10"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={255}
        />

        <Select
          label="Danh mục phản ánh"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(e) => setCategory(e.target.value as PetitionCategory)}
          required
        />

        <div>
          <label
            htmlFor="petition-description"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Nội dung chi tiết kiến nghị <span className="text-red-500">*</span>
          </label>
          <textarea
            id="petition-description"
            rows={4}
            maxLength={5000}
            placeholder="Mô tả cụ thể sự việc, địa điểm, thời gian phát sinh và đề xuất hướng xử lý..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none leading-relaxed"
          />
          <p className="mt-1 text-[11px] text-slate-400 text-right">
            {description.length}/5000 ký tự
          </p>
        </div>

        {/* Evidence upload section */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Hình ảnh minh chứng thực tế (Tối đa 5 ảnh, mỗi ảnh &le; 10 MiB)
          </label>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <input
              type="file"
              id="petition-evidence-upload"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileChange}
              disabled={selectedFiles.length >= MAX_FILES || createMutation.isPending}
              className="hidden"
            />
            <label
              htmlFor="petition-evidence-upload"
              className={`cursor-pointer inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 ${
                selectedFiles.length >= MAX_FILES ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <AppIcon name="camera" className="h-4 w-4 shrink-0 text-slate-600" />
              <span>Chọn hình ảnh chụp thực tế</span>
            </label>
            <p className="mt-1 text-[11px] text-slate-500">
              Định dạng hỗ trợ: JPEG, PNG, WebP (Tối đa 5 ảnh).
            </p>
          </div>

          {/* Selected image previews */}
          {filePreviews.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filePreviews.map((preview, index) => (
                <div
                  key={index}
                  className="relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-100 p-1"
                >
                  <Image
                    src={preview.url}
                    alt={preview.name}
                    width={200}
                    height={80}
                    unoptimized
                    className="h-20 w-full object-cover rounded-lg"
                  />
                  <div className="mt-1 flex items-center justify-between px-1">
                    <span className="text-[10px] text-slate-600 truncate max-w-[80px]">
                      {preview.name}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {(preview.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="absolute top-2 right-2 rounded-full bg-red-600 text-white p-1 text-xs shadow hover:bg-red-700 transition"
                    title="Xóa hình ảnh này"
                    aria-label={`Xóa hình ảnh ${preview.name}`}
                  >
                    <AppIcon name="x" className="h-3 w-3" />
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
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={createMutation.isPending}
          >
            Gửi kiến nghị
          </Button>
        </div>
      </form>
    </Modal>
  );
}
