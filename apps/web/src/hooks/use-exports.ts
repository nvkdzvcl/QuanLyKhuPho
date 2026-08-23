import { useState } from 'react';
import axios from 'axios';
import { ExportDataset, ExportFormat, ExportQueryDto } from '@quanlykhupho/shared-types';
import { apiClient, getErrorMessage } from '../lib/api-client';

export function buildExportParams(query: ExportQueryDto): URLSearchParams {
  const params = new URLSearchParams();
  if (query.format) params.append('format', query.format);
  if (query.neighborhoodId) params.append('neighborhoodId', query.neighborhoodId);
  if (query.search) params.append('search', query.search);
  if (query.gender) params.append('gender', query.gender);
  if (query.ageFrom !== undefined) params.append('ageFrom', String(query.ageFrom));
  if (query.ageTo !== undefined) params.append('ageTo', String(query.ageTo));
  if (query.relationshipToHead) params.append('relationshipToHead', query.relationshipToHead);
  if (query.partyStatus) params.append('partyStatus', query.partyStatus);
  if (query.minEducation) params.append('minEducation', query.minEducation);
  if (query.occupation) params.append('occupation', query.occupation);
  if (query.ward) params.append('ward', query.ward);
  if (query.month) params.append('month', query.month);
  if (query.status) params.append('status', query.status);
  if (query.category) params.append('category', query.category);
  if (query.startDate) params.append('startDate', query.startDate);
  if (query.endDate) params.append('endDate', query.endDate);
  return params;
}

export function extractFilenameFromDisposition(
  disposition: string | undefined,
  fallbackFilename: string,
): string {
  if (!disposition) return fallbackFilename;

  // Check for RFC 5987 encoded filename: filename*=UTF-8''...
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }

  // Check for standard quoted/unquoted filename: filename="..."
  const standardMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1].trim();
  }

  return fallbackFilename;
}

export async function downloadExport(
  dataset: ExportDataset,
  query: ExportQueryDto,
): Promise<void> {
  const params = buildExportParams(query);
  const format = query.format || ExportFormat.CSV;
  const fallbackExt = format === ExportFormat.XLSX ? 'xlsx' : 'csv';
  const defaultFilename = `xuat-du-lieu-${dataset}.${fallbackExt}`;

  try {
    const response = await apiClient.get<Blob>(`/exports/${dataset}?${params.toString()}`, {
      responseType: 'blob',
    });

    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = extractFilenameFromDisposition(disposition, defaultFilename);

    const blob = new Blob([response.data], {
      type:
        format === ExportFormat.XLSX
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8;',
    });

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      // If error payload is blob, convert to text and parse json
      try {
        const text = await (error.response.data as Blob).text();
        const json = JSON.parse(text);
        throw new Error(json.message || 'Không thể xuất dữ liệu.');
      } catch (innerErr) {
        if (innerErr instanceof Error && innerErr.message !== 'Không thể xuất dữ liệu.') {
          throw innerErr;
        }
        throw new Error(getErrorMessage(error));
      }
    }
    throw new Error(getErrorMessage(error));
  }
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const triggerExport = async (
    dataset: ExportDataset,
    query: ExportQueryDto,
  ): Promise<boolean> => {
    setIsExporting(true);
    setExportError(null);
    try {
      await downloadExport(dataset, query);
      setIsExporting(false);
      return true;
    } catch (err: unknown) {
      setIsExporting(false);
      const msg = err instanceof Error ? err.message : 'Xuất dữ liệu thất bại.';
      setExportError(msg);
      return false;
    }
  };

  return {
    triggerExport,
    isExporting,
    exportError,
    clearError: () => setExportError(null),
  };
}
