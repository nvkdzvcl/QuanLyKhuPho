'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from '@quanlykhupho/ui';
import {
  DashboardPetitionCategoriesQueryDto,
  NeighborhoodDetailSummaryDto,
  PetitionCategory,
  PetitionCategoryAnalyticsResponseDto,
  PetitionStatus,
} from '@quanlykhupho/shared-types';
import {
  useNeighborhoodDrillDown,
  usePetitionCategoryAnalytics,
  useWardOverview,
} from '../../hooks/use-dashboard';
import { getErrorMessage } from '../../lib/api-client';

const categoryLabels: Record<PetitionCategory, string> = {
  [PetitionCategory.INFRASTRUCTURE]: 'Hạ tầng',
  [PetitionCategory.SANITATION]: 'Vệ sinh môi trường',
  [PetitionCategory.SECURITY]: 'An ninh trật tự',
  [PetitionCategory.OTHER]: 'Khác',
};

const statusLabels: Record<PetitionStatus, string> = {
  [PetitionStatus.REVIEWING]: 'Chờ tiếp nhận',
  [PetitionStatus.PROCESSING]: 'Đang xử lý',
  [PetitionStatus.RESOLVED]: 'Đã giải quyết',
  [PetitionStatus.REJECTED]: 'Từ chối',
  [PetitionStatus.CANCELLED]: 'Đã hủy',
};

const categoryColors: Record<PetitionCategory, string> = {
  [PetitionCategory.INFRASTRUCTURE]: 'bg-blue-600',
  [PetitionCategory.SANITATION]: 'bg-emerald-600',
  [PetitionCategory.SECURITY]: 'bg-amber-500',
  [PetitionCategory.OTHER]: 'bg-slate-500',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function WardOverviewStats() {
  const overviewQuery = useWardOverview();
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<
    string | null
  >(null);
  const detailQuery = useNeighborhoodDrillDown(selectedNeighborhoodId);
  const [draftNeighborhoodId, setDraftNeighborhoodId] = useState('');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [analyticsFilters, setAnalyticsFilters] =
    useState<DashboardPetitionCategoriesQueryDto>({});
  const analyticsQuery = usePetitionCategoryAnalytics(analyticsFilters);

  const neighborhoodOptions = useMemo(
    () =>
      (overviewQuery.data?.neighborhoodSummaries ?? []).map((neighborhood) => ({
        value: neighborhood.id,
        label: `${neighborhood.name} (${neighborhood.code})`,
      })),
    [overviewQuery.data?.neighborhoodSummaries],
  );

  const applyAnalyticsFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilterError(null);

    if (draftStartDate && draftEndDate && draftStartDate > draftEndDate) {
      setFilterError('Ngày bắt đầu không được sau ngày kết thúc.');
      return;
    }

    setAnalyticsFilters({
      ...(draftNeighborhoodId
        ? { neighborhoodId: draftNeighborhoodId }
        : {}),
      ...(draftStartDate ? { startDate: draftStartDate } : {}),
      ...(draftEndDate ? { endDate: draftEndDate } : {}),
    });
  };

  const clearAnalyticsFilters = () => {
    setDraftNeighborhoodId('');
    setDraftStartDate('');
    setDraftEndDate('');
    setFilterError(null);
    setAnalyticsFilters({});
  };

  if (overviewQuery.isLoading) {
    return (
      <Card aria-busy="true">
        <CardContent className="py-12 text-center text-sm text-slate-500">
          Đang tổng hợp số liệu toàn phường...
        </CardContent>
      </Card>
    );
  }

  if (overviewQuery.isError) {
    return (
      <Alert
        variant="error"
        title="Không thể tải báo cáo địa bàn"
        message={getErrorMessage(overviewQuery.error)}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => overviewQuery.refetch()}
          >
            Thử lại
          </Button>
        }
      />
    );
  }

  const overview = overviewQuery.data;
  if (!overview) return null;

  return (
    <section className="space-y-6" aria-labelledby="ward-overview-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="ward-overview-heading"
            className="text-xl font-bold text-slate-900 sm:text-2xl"
          >
            Tổng quan địa bàn phường
          </h2>
          <p className="text-sm text-slate-500">
            Số liệu quản lý tổng hợp theo thời gian thực từ các khu phố.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => overviewQuery.refetch()}
          disabled={overviewQuery.isFetching}
        >
          {overviewQuery.isFetching ? 'Đang cập nhật...' : 'Làm mới số liệu'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Khu phố trực thuộc"
          value={overview.neighborhoodCount}
          detail="Đơn vị đang được quản lý"
          tone="blue"
        />
        <MetricCard
          label="Cư dân"
          value={overview.residentCount}
          detail={`${overview.accountsByStatus.active} hoạt động · ${overview.accountsByStatus.pending} chờ duyệt`}
          tone="emerald"
        />
        <MetricCard
          label="Kiến nghị"
          value={overview.petitionsByStatus.total}
          detail={`${overview.petitionsByStatus.resolved} đã giải quyết · ${overview.petitionsByStatus.reviewing + overview.petitionsByStatus.processing} đang xử lý`}
          tone="amber"
        />
        <MetricCard
          label="Thông báo tháng này"
          value={overview.currentMonthAnnouncementsCount}
          detail="Thông báo đã phát hành"
          tone="indigo"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chỉ số nhanh từng khu phố</CardTitle>
          <CardDescription>
            Chọn một khu phố để xem số liệu chi tiết và các nội dung gần đây.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.neighborhoodSummaries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Chưa có khu phố nào trong hệ thống.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {overview.neighborhoodSummaries.map((neighborhood) => (
                <article
                  key={neighborhood.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {neighborhood.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {neighborhood.code} · {neighborhood.ward}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedNeighborhoodId(neighborhood.id)
                      }
                      aria-label={`Xem chi tiết ${neighborhood.name}`}
                    >
                      Chi tiết
                    </Button>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <SmallMetric label="Cư dân" value={neighborhood.residentCount} />
                    <SmallMetric
                      label="Chờ duyệt"
                      value={neighborhood.pendingResidentCount}
                    />
                    <SmallMetric
                      label="Thông báo"
                      value={neighborhood.publishedAnnouncementsCount}
                    />
                    <SmallMetric
                      label="Kiến nghị"
                      value={neighborhood.totalPetitionsCount}
                    />
                  </dl>
                  <p className="mt-3 text-xs text-slate-500">
                    {neighborhood.resolvedPetitionsCount} kiến nghị đã giải quyết
                    · {neighborhood.pendingPetitionsCount} đang tiếp nhận/xử lý
                  </p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedNeighborhoodId && (
        <NeighborhoodDetail
          onClose={() => setSelectedNeighborhoodId(null)}
          isLoading={detailQuery.isLoading}
          error={detailQuery.error}
          detail={detailQuery.data ?? null}
          onRetry={() => detailQuery.refetch()}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Phân bố kiến nghị theo nhóm vấn đề</CardTitle>
          <CardDescription>
            Lọc theo khu phố hoặc khoảng ngày; cả bốn nhóm luôn được hiển thị để
            dễ đối chiếu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            onSubmit={applyAnalyticsFilters}
            className="grid gap-3 md:grid-cols-4 md:items-end"
          >
            <Select
              label="Khu phố"
              value={draftNeighborhoodId}
              onChange={(event) => setDraftNeighborhoodId(event.target.value)}
            >
              <option value="">Toàn phường</option>
              {neighborhoodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              label="Từ ngày"
              value={draftStartDate}
              onChange={(event) => setDraftStartDate(event.target.value)}
            />
            <Input
              type="date"
              label="Đến ngày"
              value={draftEndDate}
              onChange={(event) => setDraftEndDate(event.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" size="md" className="flex-1">
                Áp dụng
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={clearAnalyticsFilters}
              >
                Xóa lọc
              </Button>
            </div>
          </form>

          {filterError && <Alert variant="warning" message={filterError} />}

          {analyticsQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500" aria-live="polite">
              Đang tải biểu đồ...
            </p>
          ) : analyticsQuery.isError ? (
            <Alert
              variant="error"
              title="Không thể tải số liệu kiến nghị"
              message={getErrorMessage(analyticsQuery.error)}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => analyticsQuery.refetch()}
                >
                  Thử lại
                </Button>
              }
            />
          ) : analyticsQuery.data ? (
            <PetitionCategoryChart analytics={analyticsQuery.data} />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  detail: string;
  tone: 'blue' | 'emerald' | 'amber' | 'indigo';
}

const metricTones: Record<MetricCardProps['tone'], string> = {
  blue: 'border-blue-100 bg-blue-50 text-blue-950',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-950',
  amber: 'border-amber-100 bg-amber-50 text-amber-950',
  indigo: 'border-indigo-100 bg-indigo-50 text-indigo-950',
};

function MetricCard({ label, value, detail, tone }: MetricCardProps) {
  return (
    <div className={`rounded-2xl border p-5 ${metricTones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs opacity-75">{detail}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

interface NeighborhoodDetailProps {
  isLoading: boolean;
  error: Error | null;
  detail: NeighborhoodDetailSummaryDto | null;
  onClose: () => void;
  onRetry: () => void;
}

function NeighborhoodDetail({
  isLoading,
  error,
  detail,
  onClose,
  onRetry,
}: NeighborhoodDetailProps) {
  return (
    <Card aria-busy={isLoading}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Chi tiết khu phố</CardTitle>
            <CardDescription>
              Thống kê cư dân, thông báo và kiến nghị hiện có.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Đang tải chi tiết khu phố...
          </p>
        ) : error ? (
          <Alert
            variant="error"
            message={getErrorMessage(error)}
            action={
              <Button variant="outline" size="sm" onClick={onRetry}>
                Thử lại
              </Button>
            }
          />
        ) : detail ? (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {detail.neighborhood.name} ({detail.neighborhood.code})
              </h3>
              <p className="text-sm text-slate-500">
                {detail.neighborhood.ward}, {detail.neighborhood.district},{' '}
                {detail.neighborhood.city}
              </p>
              {detail.neighborhood.description && (
                <p className="mt-1 text-sm text-slate-600">
                  {detail.neighborhood.description}
                </p>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SmallMetric label="Cư dân" value={detail.residentCount} />
              <SmallMetric
                label="Cư dân hoạt động"
                value={detail.accountsByStatus.active}
              />
              <SmallMetric
                label="Thông báo đã đăng"
                value={detail.publishedAnnouncementsCount}
              />
              <SmallMetric label="Kiến nghị" value={detail.petitionsByStatus.total} />
            </dl>

            <Alert
              variant="info"
              message="Màn hình hiển thị các số liệu thống kê tổng hợp và nội dung hoạt động đã được ghi nhận trong hệ thống."
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <RecentAnnouncements items={detail.recentAnnouncements} />
              <RecentPetitions items={detail.recentPetitions} />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RecentAnnouncements({
  items,
}: {
  items: NeighborhoodDetailSummaryDto['recentAnnouncements'];
}) {
  return (
    <div>
      <h4 className="font-bold text-slate-900">Thông báo gần đây</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Chưa có thông báo.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg bg-slate-50 p-3">
              <p className="font-medium text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.authorName} · {formatDate(item.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentPetitions({
  items,
}: {
  items: NeighborhoodDetailSummaryDto['recentPetitions'];
}) {
  return (
    <div>
      <h4 className="font-bold text-slate-900">Kiến nghị gần đây</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Chưa có kiến nghị.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{item.title}</p>
                <Badge variant="info">{categoryLabels[item.category]}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {statusLabels[item.status]} · {item.authorName} ·{' '}
                {formatDate(item.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PetitionCategoryChart({
  analytics,
}: {
  analytics: PetitionCategoryAnalyticsResponseDto;
}) {
  const maxCount = Math.max(...analytics.series.map((item) => item.count), 1);

  return (
    <figure aria-labelledby="petition-chart-caption">
      <figcaption
        id="petition-chart-caption"
        className="mb-4 text-sm font-semibold text-slate-700"
      >
        Tổng cộng {analytics.total} kiến nghị trong phạm vi đã chọn
      </figcaption>

      <div className="space-y-4">
        {analytics.series.map((item) => {
          const width = `${Math.round((item.count / maxCount) * 100)}%`;
          return (
            <div key={item.category}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">
                  {categoryLabels[item.category]}
                </span>
                <span className="tabular-nums text-slate-600">
                  {item.count} ({item.percentage}%) · {item.resolvedCount} đã xử lý
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  role="progressbar"
                  aria-label={`${categoryLabels[item.category]}: ${item.count} kiến nghị, ${item.percentage} phần trăm`}
                  aria-valuemin={0}
                  aria-valuemax={maxCount}
                  aria-valuenow={item.count}
                  className={`h-full rounded-full ${categoryColors[item.category]}`}
                  style={{ width }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
