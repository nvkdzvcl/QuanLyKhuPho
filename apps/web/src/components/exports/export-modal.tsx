'use client';

import React, { useState } from 'react';
import { Alert, Badge, Button, Modal } from '@quanlykhupho/ui';
import { ExportDataset, ExportFormat, ExportQueryDto } from '@quanlykhupho/shared-types';
import { useExport } from '../../hooks/use-exports';
import { AppIcon } from '../app-icon';

export interface FilterSummaryItem {
  label: string;
  value: string;
}

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: ExportDataset;
  title: string;
  description?: string;
  filters: ExportQueryDto;
  filterSummary?: FilterSummaryItem[];
}

export interface ExportModalState {
  isOpen: boolean;
  selectedDataset: ExportDataset;
  selectedFormat: ExportFormat;
}

export const DATASET_LABELS: Record<ExportDataset, string> = {
  [ExportDataset.RESIDENTS]: 'Danh sách cư dân',
  [ExportDataset.POLITICAL_SOCIAL]: 'Thông tin Chính trị - Xã hội',
  [ExportDataset.ACTIVITIES]: 'Sổ hoạt động khu phố',
  [ExportDataset.PETITIONS]: 'Danh sách kiến nghị',
};

export function getInitialExportModalState(
  dataset: ExportDataset,
  isOpen = false,
  format = ExportFormat.CSV,
): ExportModalState {
  return {
    isOpen,
    selectedDataset: dataset,
    selectedFormat: format,
  };
}

export function resolveExportModalTransition(
  currentState: ExportModalState,
  nextProps: { isOpen: boolean; dataset: ExportDataset },
): ExportModalState {
  const isOpening = nextProps.isOpen && !currentState.isOpen;

  if (isOpening) {
    return {
      isOpen: true,
      selectedDataset: nextProps.dataset,
      selectedFormat: ExportFormat.CSV,
    };
  }

  return {
    ...currentState,
    isOpen: nextProps.isOpen,
  };
}

export function getFormatButtonAriaProps(
  format: ExportFormat,
  selectedFormat: ExportFormat,
  isExporting = false,
) {
  const isSelected = format === selectedFormat;
  return {
    type: 'button' as const,
    'aria-pressed': isSelected,
    disabled: isExporting,
  };
}

export function ExportModal({
  isOpen,
  onClose,
  dataset,
  title,
  description,
  filters,
  filterSummary = [],
}: ExportModalProps) {
  const [modalState, setModalState] = useState<ExportModalState>(() =>
    getInitialExportModalState(dataset, isOpen),
  );

  // Sync state on prop changes (e.g., closed-to-open transition)
  const nextState = resolveExportModalTransition(modalState, {
    isOpen,
    dataset,
  });

  if (
    nextState.isOpen !== modalState.isOpen ||
    nextState.selectedDataset !== modalState.selectedDataset ||
    nextState.selectedFormat !== modalState.selectedFormat
  ) {
    setModalState(nextState);
  }

  const { triggerExport, isExporting, exportError, clearError } = useExport();

  const handleExport = async () => {
    clearError();
    const success = await triggerExport(modalState.selectedDataset, {
      ...filters,
      format: modalState.selectedFormat,
    });
    if (success) {
      onClose();
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      clearError();
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={
        description ||
        'Xuất toàn bộ dữ liệu báo cáo và quản lý theo định dạng tùy chọn.'
      }
      footer={
        <>
          <Button
            variant="outline"
            size="md"
            onClick={handleClose}
            disabled={isExporting}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleExport}
            isLoading={isExporting}
          >
            {isExporting ? 'Đang xuất dữ liệu...' : 'Tải xuống tệp'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {exportError && (
          <Alert
            variant="error"
            message={exportError}
            onClose={clearError}
          />
        )}

        {/* Applied Filters Summary */}
        {filterSummary.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <h5 className="font-semibold text-slate-700">
              Bộ lọc đang áp dụng:
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {filterSummary.map((f, idx) => (
                <Badge key={idx} variant="info">
                  <span className="font-medium text-slate-600 mr-1">{f.label}:</span>
                  <span className="font-bold">{f.value}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="export-dataset"
            className="block text-xs font-bold text-slate-800"
          >
            Loại dữ liệu xuất:
          </label>
          <select
            id="export-dataset"
            value={modalState.selectedDataset}
            onChange={(event) =>
              setModalState((prev) => ({
                ...prev,
                selectedDataset: event.target.value as ExportDataset,
              }))
            }
            disabled={isExporting}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none"
          >
            {Object.values(ExportDataset).map((value) => (
              <option key={value} value={value}>
                {DATASET_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {/* Format Selection */}
        <div className="space-y-2">
          <label
            id="export-format-label"
            className="block text-xs font-bold text-slate-800"
          >
            Chọn định dạng tệp xuất:
          </label>
          <div
            role="group"
            aria-labelledby="export-format-label"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
          >
            <button
              {...getFormatButtonAriaProps(
                ExportFormat.CSV,
                modalState.selectedFormat,
                isExporting,
              )}
              onClick={() =>
                setModalState((prev) => ({
                  ...prev,
                  selectedFormat: ExportFormat.CSV,
                }))
              }
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                modalState.selectedFormat === ExportFormat.CSV
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              } ${isExporting ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div
                aria-hidden="true"
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300"
              >
                {modalState.selectedFormat === ExportFormat.CSV && (
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                )}
              </div>
              <div>
                <div className="font-bold text-slate-900">CSV (UTF-8 with BOM)</div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Tương thích mọi phần mềm bảng tính, mã hóa UTF-8 đầy đủ dấu tiếng Việt.
                </p>
              </div>
            </button>

            <button
              {...getFormatButtonAriaProps(
                ExportFormat.XLSX,
                modalState.selectedFormat,
                isExporting,
              )}
              onClick={() =>
                setModalState((prev) => ({
                  ...prev,
                  selectedFormat: ExportFormat.XLSX,
                }))
              }
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                modalState.selectedFormat === ExportFormat.XLSX
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              } ${isExporting ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div
                aria-hidden="true"
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300"
              >
                {modalState.selectedFormat === ExportFormat.XLSX && (
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                )}
              </div>
              <div>
                <div className="font-bold text-slate-900">Microsoft Excel (.xlsx)</div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Sổ tính Excel chuẩn có tiêu đề cố định (frozen header) và tự động căn chỉnh độ rộng cột.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Security & Privacy Notice */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-[11px] text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-800">
            <AppIcon name="shield" className="h-4 w-4 shrink-0 text-amber-800" />
            <span>Bảo mật & Quyền riêng tư thông tin:</span>
          </div>
          <p>
            • Toàn bộ dữ liệu khớp với bộ lọc sẽ được xuất (tối đa 10.000 dòng), không giới hạn theo trang đang hiển thị.
          </p>
          <p>
            • Số CCCD, số điện thoại và email được mã hóa che tự động (masking) theo đúng quy định phân quyền.
          </p>
        </div>
      </div>
    </Modal>
  );
}
