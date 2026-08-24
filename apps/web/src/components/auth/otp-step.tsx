'use client';

import React, { useEffect, useState } from 'react';
import { Button, Input, Alert } from '@quanlykhupho/ui';
import {
  AccountStatus,
  ApiResponseEnvelope,
  ErrorCode,
  UserDto,
  VerifyOtpResponseDto,
} from '@quanlykhupho/shared-types';
import { apiClient, getErrorCode, getErrorMessage } from '../../lib/api-client';
import { DevSmsInbox } from './dev-sms-inbox';

interface OtpStepProps {
  phoneNumber: string;
  initialRetryAfter?: number;
  initialExpiresIn?: number;
  onLoginSuccess: (user: UserDto) => void;
  onNeedsRegistration: (registerToken: string) => void;
  onAccountStatusBlocked: (
    status: AccountStatus,
    reason?: string,
    message?: string,
  ) => void;
  onBack: () => void;
}

export function OtpStep({
  phoneNumber,
  initialRetryAfter = 60,
  initialExpiresIn = 300,
  onLoginSuccess,
  onNeedsRegistration,
  onAccountStatusBlocked,
  onBack,
}: OtpStepProps) {
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [retryCooldown, setRetryCooldown] = useState(initialRetryAfter);
  const [expiresCountdown, setExpiresCountdown] = useState(initialExpiresIn);

  // Timer countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setRetryCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setExpiresCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otpCode.trim();
    if (cleanOtp.length !== 6) {
      setError('Vui lòng nhập đúng 6 chữ số mã OTP');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.post<
        ApiResponseEnvelope<VerifyOtpResponseDto>
      >('/auth/verify-otp', {
        phoneNumber,
        otpCode: cleanOtp,
      });

      const data = res.data.data;
      if (data.isRegistered && data.user) {
        onLoginSuccess(data.user);
      } else if (!data.isRegistered && data.registerToken) {
        onNeedsRegistration(data.registerToken);
      }
    } catch (err: unknown) {
      const errorCode = getErrorCode(err);
      const errorMsg = getErrorMessage(err);

      if (errorCode === ErrorCode.ACCOUNT_PENDING) {
        onAccountStatusBlocked(AccountStatus.PENDING, undefined, errorMsg);
      } else if (errorCode === ErrorCode.ACCOUNT_REJECTED) {
        onAccountStatusBlocked(AccountStatus.REJECTED, undefined, errorMsg);
      } else if (errorCode === ErrorCode.ACCOUNT_LOCKED) {
        onAccountStatusBlocked(AccountStatus.LOCKED, undefined, errorMsg);
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (retryCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);

    try {
      const res = await apiClient.post('/auth/send-otp', { phoneNumber });
      const data = res.data.data;
      setRetryCooldown(data.retryAfter || 60);
      setExpiresCountdown(data.expiresIn || 300);
      setOtpCode('');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  const formatMinutes = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 leading-tight">
            Nhập mã xác thực OTP
          </h2>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Đổi số khác
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Mã 6 chữ số đã được gửi tới số{' '}
          <strong className="font-semibold text-slate-900">
            {phoneNumber}
          </strong>
          .
        </p>
      </div>

      {error && (
        <Alert
          variant="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {expiresCountdown > 0 ? (
        <div className="flex items-center justify-between rounded-lg bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
          <span>Thời hạn hiệu lực của mã OTP:</span>
          <span className="font-mono font-bold">
            {formatMinutes(expiresCountdown)}
          </span>
        </div>
      ) : (
        <Alert
          variant="warning"
          message="Mã OTP đã hết hiệu lực. Vui lòng bấm 'Gửi lại mã' để nhận mã mới."
        />
      )}

      <Input
        label="Mã OTP (6 chữ số)"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="••••••"
        value={otpCode}
        onChange={(e) =>
          setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
        }
        disabled={isLoading || expiresCountdown === 0}
        required
        autoFocus
        className="text-center font-mono text-xl tracking-[0.5em]"
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        isLoading={isLoading}
        disabled={otpCode.length !== 6 || expiresCountdown === 0}
      >
        Xác nhận OTP
      </Button>

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-slate-500">Chưa nhận được mã?</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResend}
          disabled={retryCooldown > 0 || isResending}
          isLoading={isResending}
        >
          {retryCooldown > 0
            ? `Gửi lại sau ${retryCooldown}s`
            : 'Gửi lại mã'}
        </Button>
      </div>

      <DevSmsInbox
        currentPhoneNumber={phoneNumber}
        onAutofillOtp={(code) => {
          setOtpCode(code);
          setError(null);
        }}
      />
    </form>
  );
}
