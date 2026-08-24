'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  HealthResponseDto,
  HealthStatus,
  ServiceHealth,
  isSystemHealthy,
} from '@quanlykhupho/shared-types';
import { Button } from '@quanlykhupho/ui';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const fallbackHealth: HealthResponseDto = {
  status: 'down',
  version: '0.1.0',
  timestamp: new Date().toISOString(),
  environment: 'Không xác định',
  services: {
    database: { status: 'down', message: 'Chưa kiểm tra được PostgreSQL' },
    redis: { status: 'down', message: 'Chưa kiểm tra được Redis' },
    rabbitmq: { status: 'down', message: 'Chưa kiểm tra được RabbitMQ' },
  },
};

function isServiceHealth(value: unknown): value is ServiceHealth {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const status = (value as { status?: unknown }).status;
  return status === 'ok' || status === 'degraded' || status === 'down';
}

/**
 * Parses and validates raw health payload from API response envelope or direct DTO.
 * Throws an error if payload cannot be resolved into a valid HealthResponseDto.
 */
export function parseHealthResponse(
  payload: ApiResponseEnvelope<HealthResponseDto> | unknown,
): HealthResponseDto {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Phản hồi trạng thái hệ thống không hợp lệ');
  }

  const record = payload as Record<string, unknown>;
  const rawData =
    typeof record.data === 'object' && record.data !== null
      ? record.data
      : payload;

  if (typeof rawData !== 'object' || rawData === null) {
    throw new Error('Dữ liệu trạng thái hệ thống không hợp lệ');
  }

  const candidate = rawData as Record<string, unknown>;
  const status = candidate.status;
  if (status !== 'ok' && status !== 'degraded' && status !== 'down') {
    throw new Error('Trạng thái hệ thống không hợp lệ');
  }

  if (typeof candidate.services !== 'object' || candidate.services === null) {
    throw new Error('Thông tin dịch vụ hạ tầng không hợp lệ');
  }

  const servicesRecord = candidate.services as Record<string, unknown>;
  const database = isServiceHealth(servicesRecord.database)
    ? servicesRecord.database
    : undefined;
  const redis = isServiceHealth(servicesRecord.redis)
    ? servicesRecord.redis
    : undefined;
  const rabbitmq = isServiceHealth(servicesRecord.rabbitmq)
    ? servicesRecord.rabbitmq
    : undefined;

  return {
    status: status as HealthStatus,
    version:
      typeof candidate.version === 'string' ? candidate.version : '0.1.0',
    timestamp:
      typeof candidate.timestamp === 'string'
        ? candidate.timestamp
        : new Date().toISOString(),
    environment:
      typeof candidate.environment === 'string'
        ? candidate.environment
        : 'Không xác định',
    services: {
      database,
      redis,
      rabbitmq,
    },
  };
}

export async function fetchApiHealth(
  baseUrl: string = API_BASE_URL,
): Promise<HealthResponseDto> {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok && res.status !== 503) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const payload = (await res.json()) as unknown;
  return parseHealthResponse(payload);
}

export function HealthStatusWidget() {
  const { data, error, isLoading, refetch, isFetching } =
    useQuery<HealthResponseDto>({
      queryKey: ['system-health'],
      queryFn: () => fetchApiHealth(),
      retry: 1,
    });

  const currentHealth = data ?? fallbackHealth;
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
            {isLoading
              ? 'Đang kiểm tra kết nối API...'
              : error
                ? 'Không thể kết nối API trực tiếp (API đang tắt hoặc chưa khởi động)'
                : 'Đã nhận trạng thái hạ tầng từ API'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            isLoading={isFetching}
            onClick={() => void refetch()}
          >
            Làm mới
          </Button>
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
          Dịch vụ hạ tầng
        </h4>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-2xs">
            <span className="text-sm font-medium text-slate-700">PostgreSQL</span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              {currentHealth.services?.database?.status === 'ok'
                ? 'Sẵn sàng'
                : 'Chưa kết nối'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-2xs">
            <span className="text-sm font-medium text-slate-700">Redis Cache</span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              {currentHealth.services?.redis?.status === 'ok'
                ? 'Sẵn sàng'
                : 'Chưa kết nối'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-2xs">
            <span className="text-sm font-medium text-slate-700">RabbitMQ</span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              {currentHealth.services?.rabbitmq?.status === 'ok'
                ? 'Sẵn sàng'
                : 'Chưa kết nối'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
