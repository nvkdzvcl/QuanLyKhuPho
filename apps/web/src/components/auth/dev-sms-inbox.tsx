'use client';

import React, { useEffect, useState } from 'react';
import type {
  ApiResponseEnvelope,
  DevSmsInboxItemDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from '../../lib/api-client';

export interface DevSmsInboxProps {
  currentPhoneNumber: string;
  onAutofillOtp: (otp: string) => void;
  pollIntervalMs?: number;
}

/**
 * Normalizes and masks a phone number for matching against server-masked phone numbers (e.g. 091***5678).
 */
export function maskPhoneNumberClient(phone: string): string {
  if (!phone || typeof phone !== 'string') return '***';
  const cleaned = phone.trim().replace(/[\s\-.()]/g, '');
  const local = cleaned.startsWith('+84')
    ? '0' + cleaned.slice(3)
    : cleaned.startsWith('84')
      ? '0' + cleaned.slice(2)
      : cleaned;
  if (local.length < 7) {
    return '***';
  }
  return `${local.slice(0, 3)}***${local.slice(-4)}`;
}

/**
 * Finds the latest OTP message matching the phone number from the newest-first inbox array.
 */
export function findMatchingDevOtp(
  messages: DevSmsInboxItemDto[],
  phoneNumber: string,
): DevSmsInboxItemDto | null {
  if (!messages || messages.length === 0 || !phoneNumber) {
    return null;
  }
  const targetMask = maskPhoneNumberClient(phoneNumber);
  if (targetMask === '***') return null;

  return messages.find((msg) => msg.maskedPhone === targetMask) || null;
}

export function DevSmsInbox({
  currentPhoneNumber,
  onAutofillOtp,
  pollIntervalMs = 1000,
}: DevSmsInboxProps) {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <DevSmsInboxContent
      currentPhoneNumber={currentPhoneNumber}
      onAutofillOtp={onAutofillOtp}
      pollIntervalMs={pollIntervalMs}
    />
  );
}

function DevSmsInboxContent({
  currentPhoneNumber,
  onAutofillOtp,
  pollIntervalMs,
}: Required<DevSmsInboxProps>) {
  const [inbox, setInbox] = useState<DevSmsInboxItemDto[]>([]);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchInbox = async () => {
      try {
        const res = await apiClient.get<
          ApiResponseEnvelope<DevSmsInboxItemDto[]>
        >('/dev/sms-inbox');
        if (!isMounted) return;
        const data = res.data?.data;
        if (Array.isArray(data)) {
          setInbox(data);
          setIsAvailable(true);
        }
      } catch {
        if (!isMounted) return;
        // Quietly mark unavailable on 404 or connection error without disrupting login
        setIsAvailable(false);
      }
    };

    fetchInbox();
    const interval = setInterval(fetchInbox, pollIntervalMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  if (!isAvailable) {
    return null;
  }

  const latestMatching = findMatchingDevOtp(inbox, currentPhoneNumber);

  return (
    <div
      data-testid="dev-sms-inbox-panel"
      className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <div className="flex items-center justify-between font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Dev SMS Inbox (Môi trường phát triển)
        </span>
        <span className="text-[10px] font-normal text-amber-700">
          Tự động làm mới
        </span>
      </div>

      {latestMatching ? (
        <div className="mt-2 flex items-center justify-between rounded border border-amber-200 bg-white p-2 shadow-sm">
          <div>
            <div className="text-[11px] text-slate-500">
              Số:{' '}
              <span className="font-mono font-medium text-slate-700">
                {latestMatching.maskedPhone}
              </span>
            </div>
            <div className="font-mono text-base font-bold tracking-wider text-slate-900">
              {latestMatching.otpCode}
            </div>
          </div>
          <button
            type="button"
            data-testid="dev-sms-autofill-btn"
            onClick={() => onAutofillOtp(latestMatching.otpCode)}
            className="rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-amber-600 active:bg-amber-700"
          >
            Tự động điền
          </button>
        </div>
      ) : (
        <p className="mt-2 italic text-slate-500">
          {inbox.length === 0
            ? 'Chưa có mã OTP nào trong hàng đợi dev.'
            : `Đang chờ OTP cho ${currentPhoneNumber}...`}
        </p>
      )}

      {inbox.length > 0 && (
        <div className="mt-2 border-t border-amber-200/60 pt-2">
          <div className="mb-1 text-[10px] font-medium text-amber-800">
            Lịch sử gần đây ({inbox.length}/20):
          </div>
          <div className="max-h-24 space-y-1 overflow-y-auto">
            {inbox.slice(0, 5).map((item) => (
              <div
                key={item.commandId}
                className="flex items-center justify-between rounded bg-amber-100/50 px-1.5 py-0.5 text-[11px] text-slate-600"
              >
                <span>
                  {item.maskedPhone}:{' '}
                  <strong className="font-mono">{item.otpCode}</strong>
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(item.createdAt).toLocaleTimeString('vi-VN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
