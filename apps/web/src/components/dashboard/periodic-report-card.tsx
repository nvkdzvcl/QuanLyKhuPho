'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
} from '@quanlykhupho/ui';
import {
  PeriodicReportQueryDto,
  ReportingPeriodType,
} from '@quanlykhupho/shared-types';
import { usePeriodicReport } from '../../hooks/use-dashboard';
import { getErrorMessage } from '../../lib/api-client';
import { downloadPeriodicReportCsv } from '../../lib/periodic-report-csv';

function formatUtcDateTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function formatUtcDateOnly(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function formatInclusiveUtcEndDate(endDateExclusive: string): string {
  const endTimestamp = Date.parse(endDateExclusive);
  if (Number.isNaN(endTimestamp)) {
    return endDateExclusive;
  }
  return formatUtcDateOnly(new Date(endTimestamp - 1).toISOString());
}

export function PeriodicReportCard() {
  const now = useMemo(() => new Date(), []);
  const currentUtcYear = now.getUTCFullYear();
  const currentUtcMonth = now.getUTCMonth() + 1; // 1..12
  const currentUtcQuarter = Math.floor(now.getUTCMonth() / 3) + 1; // 1..4

  // Form controls state (defaults to current month)
  const [periodType, setPeriodType] = useState<ReportingPeriodType>(
    ReportingPeriodType.MONTH,
  );
  const [selectedYear, setSelectedYear] = useState<number>(currentUtcYear);
  const [selectedPeriod, setSelectedPeriod] =
    useState<number>(currentUtcMonth);

  // Active query state used to fetch report data
  const [activeQuery, setActiveQuery] = useState<PeriodicReportQueryDto>({
    periodType: ReportingPeriodType.MONTH,
    year: currentUtcYear,
    period: currentUtcMonth,
  });

  const {
    data: report,
    isLoading,
    isFetching,
    error,
    refetch,
  } = usePeriodicReport(activeQuery);

  // Keep the UI range aligned with the API validation range.
  const yearOptions = useMemo(() => {
    const years: { value: string; label: string }[] = [];
    for (let y = currentUtcYear; y >= 2000; y--) {
      years.push({ value: String(y), label: `Năm ${y}` });
    }
    return years;
  }, [currentUtcYear]);

  // Period options based on month/quarter and year
  const periodOptions = useMemo(() => {
    if (periodType === ReportingPeriodType.QUARTER) {
      const quarters = [
        { value: '1', label: 'Quý 1 (Tháng 1 - Tháng 3)' },
        { value: '2', label: 'Quý 2 (Tháng 4 - Tháng 6)' },
        { value: '3', label: 'Quý 3 (Tháng 7 - Tháng 9)' },
        { value: '4', label: 'Quý 4 (Tháng 10 - Tháng 12)' },
      ];
      // Filter out future quarters if current year is selected
      if (selectedYear === currentUtcYear) {
        return quarters.filter((q) => Number(q.value) <= currentUtcQuarter);
      }
      return quarters;
    }

    // Monthly options
    const months = Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: `Tháng ${i + 1}`,
    }));
    // Filter out future months if current year is selected
    if (selectedYear === currentUtcYear) {
      return months.filter((m) => Number(m.value) <= currentUtcMonth);
    }
    return months;
  }, [
    periodType,
    selectedYear,
    currentUtcYear,
    currentUtcQuarter,
    currentUtcMonth,
  ]);

  const handlePeriodTypeChange = (newTypeStr: string) => {
    const newType = newTypeStr as ReportingPeriodType;
    setPeriodType(newType);

    if (newType === ReportingPeriodType.QUARTER) {
      const defaultQuarter =
        selectedYear === currentUtcYear ? currentUtcQuarter : 1;
      setSelectedPeriod(defaultQuarter);
    } else {
      const defaultMonth =
        selectedYear === currentUtcYear ? currentUtcMonth : 1;
      setSelectedPeriod(defaultMonth);
    }
  };

  const handleYearChange = (newYearStr: string) => {
    const newYear = Number(newYearStr);
    setSelectedYear(newYear);

    // If changing to current year and selected period is future, clamp it
    if (newYear === currentUtcYear) {
      if (
        periodType === ReportingPeriodType.QUARTER &&
        selectedPeriod > currentUtcQuarter
      ) {
        setSelectedPeriod(currentUtcQuarter);
      } else if (
        periodType === ReportingPeriodType.MONTH &&
        selectedPeriod > currentUtcMonth
      ) {
        setSelectedPeriod(currentUtcMonth);
      }
    }
  };

  const handlePreviewSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActiveQuery({
      periodType,
      year: selectedYear,
      period: selectedPeriod,
    });
  };

  const handleDownloadCsv = () => {
    if (!report) return;
    downloadPeriodicReportCsv(report);
  };

  return (
    <Card aria-labelledby="periodic-report-heading">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle id="periodic-report-heading">
              Báo cáo Định kỳ Toàn Phường
            </CardTitle>
            <CardDescription>
              Xem trước và tải về báo cáo định kỳ tổng hợp theo tháng hoặc theo quý (chuẩn định dạng UTF-8 CSV).
            </CardDescription>
          </div>
          {report && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleDownloadCsv}
              disabled={isLoading}
              className="font-semibold shadow-sm text-xs sm:text-sm self-start sm:self-auto"
            >
              📥 Xuất file CSV (UTF-8)
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Controls form */}
        <form
          onSubmit={handlePreviewSubmit}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end rounded-2xl bg-slate-50 p-4 border border-slate-200/80"
        >
          <Select
            label="Loại kỳ báo cáo"
            value={periodType}
            onChange={(e) => handlePeriodTypeChange(e.target.value)}
          >
            <option value={ReportingPeriodType.MONTH}>Hàng tháng</option>
            <option value={ReportingPeriodType.QUARTER}>Hàng quý</option>
          </Select>

          <Select
            label="Năm báo cáo"
            value={String(selectedYear)}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Select
            label={periodType === ReportingPeriodType.QUARTER ? 'Quý' : 'Tháng'}
            value={String(selectedPeriod)}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <div className="flex gap-2">
            <Button
              type="submit"
              variant="secondary"
              size="md"
              disabled={isFetching}
              className="flex-1"
            >
              {isFetching ? 'Đang tải...' : 'Xem trước báo cáo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Làm mới báo cáo"
            >
              ↻
            </Button>
          </div>
        </form>

        {/* Loading state */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-500" aria-live="polite">
            Đang tổng hợp số liệu báo cáo định kỳ...
          </div>
        ) : error ? (
          /* Error state */
          <Alert
            variant="error"
            title="Không thể tải báo cáo định kỳ"
            message={getErrorMessage(error)}
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Thử lại
              </Button>
            }
          />
        ) : report ? (
          /* Report content */
          <div className="space-y-6">
            {/* Metadata bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50/70 border border-blue-100 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-blue-950">
                    {report.label}
                  </span>
                  <Badge variant={report.isDataSufficient ? 'success' : 'warning'}>
                    {report.isDataSufficient
                      ? 'Dữ liệu đầy đủ'
                      : 'Cần lưu ý'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-blue-800">
                  Phạm vi: {formatUtcDateOnly(report.startDate)} —{' '}
                  {formatInclusiveUtcEndDate(report.endDateExclusive)} (UTC)
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Lập lúc: {formatUtcDateTime(report.generatedAt)} UTC
              </div>
            </div>

            {/* Warnings list */}
            {report.warnings.length > 0 && (
              <Alert
                variant="warning"
                title="Lưu ý về số liệu báo cáo"
                message={report.warnings.join(' • ')}
              />
            )}

            {/* Summary metrics grid */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">
                Tổng hợp toàn Phường
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500 font-medium">Khu phố</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {report.summary.neighborhoodCount}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Đơn vị quản lý</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500 font-medium">Cư dân hoạt động</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
                    {report.summary.activeResidentCount}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Snapshot hiện tại</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500 font-medium">Đăng ký mới trong kỳ</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700">
                    {report.summary.newResidentRegistrationsCount}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Hồ sơ phát sinh</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500 font-medium">Thông báo phát hành</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-700">
                    {report.summary.publishedAnnouncementsCount}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Trong kỳ báo cáo</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 col-span-2 sm:col-span-1">
                  <p className="text-xs text-slate-500 font-medium">Kiến nghị trong kỳ</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
                    {report.summary.petitionsByStatus.total}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {report.summary.petitionsByStatus.resolved} đã xong ·{' '}
                    {report.summary.petitionsByStatus.reviewing +
                      report.summary.petitionsByStatus.processing}{' '}
                    đang xử lý
                  </p>
                </div>
              </div>
            </div>

            {/* Neighborhood Breakdown Table */}
            <div>
              <div className="mb-3 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Chi tiết số liệu theo từng Khu phố
                </h3>
                <span className="text-xs text-slate-500">
                  {report.neighborhoods.length} khu phố
                </span>
              </div>

              {report.neighborhoods.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  Chưa có khu phố nào được cấu hình trong hệ thống.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-[860px] divide-y divide-slate-200 text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Mã KP
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Tên khu phố
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">
                          Cư dân HĐ
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">
                          ĐK mới
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">
                          Thông báo
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">
                          Tổng KN
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">
                          Đã giải quyết
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">
                          Đang xử lý
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-right">
                          Từ chối/Hủy
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {report.neighborhoods.map((n) => (
                        <tr key={n.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-slate-900">
                            {n.code}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {n.name}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">
                            {n.activeResidentCount}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-blue-700">
                            {n.newResidentRegistrationsCount}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                            {n.publishedAnnouncementsCount}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                            {n.petitionsByStatus.total}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">
                            {n.petitionsByStatus.resolved}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-amber-600 font-medium">
                            {n.petitionsByStatus.reviewing +
                              n.petitionsByStatus.processing}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-500">
                            {n.petitionsByStatus.rejected +
                              n.petitionsByStatus.cancelled}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
