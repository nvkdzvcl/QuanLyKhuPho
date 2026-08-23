'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HealthResponseDto, isSystemHealthy } from '@quanlykhupho/shared-types';
import { Button } from '@quanlykhupho/ui';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const fallbackHealth: HealthResponseDto = {
  status: 'ok',
  version: '0.1.0',
  timestamp: new Date().toISOString(),
  environment: 'development (offline preview)',
  services: {
    database: { status: 'ok', message: 'Sẵn sàng kết nối PostgreSQL' },
    redis: { status: 'ok', message: 'Sẵn sàng kết nối Redis' },
    rabbitmq: { status: 'ok', message: 'Sẵn sàng kết nối RabbitMQ' },
  },
};

async function fetchApiHealth(): Promise<HealthResponseDto> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return (await res.json()) as HealthResponseDto;
}

export function HealthStatusWidget() {
  const [useLiveApi, setUseLiveApi] = useState(false);

  const { data, error, isLoading, refetch, isFetching } = useQuery<HealthResponseDto>({
    queryKey: ['system-health'],
    queryFn: fetchApiHealth,
    enabled: useLiveApi,
    retry: 1,
  });

  const currentHealth = useLiveApi && data ? data : fallbackHealth;
  const isHealthy = isSystemHealthy(currentHealth);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <h3 className="text-lg font-semibold text-slate-900">
              Trạng thái hệ thống (Health Check)
            </h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {useLiveApi
              ? isLoading
                ? 'Đang kiểm tra kết nối API...'
                : error
                  ? 'Không thể kết nối API trực tiếp (API đang tắt hoặc chưa khởi động)'
                  : 'Đã kết nối API trực tiếp thành công'
              : 'Đang hiển thị trạng thái khởi tạo (Phase 0 Standalone Preview)'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={useLiveApi ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setUseLiveApi(!useLiveApi)}
          >
            {useLiveApi ? 'Chuyển sang chế độ Preview' : 'Kiểm tra API trực tiếp'}
          </Button>

          {useLiveApi && (
            <Button
              variant="primary"
              size="sm"
              isLoading={isFetching}
              onClick={() => void refetch()}
            >
              Làm mới
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Môi trường
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-800">
            {currentHealth.environment}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Phiên bản
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-800">
            v{currentHealth.version}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Thời gian phản hồi
          </div>
          <div className="mt-1 font-mono text-xs font-medium text-slate-700 truncate">
            {currentHealth.timestamp}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Dịch vụ hạ tầng dự kiến (Phase 0 Scaffold)
        </h4>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-2xs">
            <span className="text-sm font-medium text-slate-700">PostgreSQL</span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              {currentHealth.services.database?.status === 'ok' ? 'Sẵn sàng' : 'Chưa kết nối'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-2xs">
            <span className="text-sm font-medium text-slate-700">Redis Cache</span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              {currentHealth.services.redis?.status === 'ok' ? 'Sẵn sàng' : 'Chưa kết nối'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-2xs">
            <span className="text-sm font-medium text-slate-700">RabbitMQ</span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              {currentHealth.services.rabbitmq?.status === 'ok' ? 'Sẵn sàng' : 'Chưa kết nối'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
