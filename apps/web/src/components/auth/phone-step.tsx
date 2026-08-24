'use client';

import React, { useState } from 'react';
import { Button, Input, Alert } from '@quanlykhupho/ui';
import { ApiResponseEnvelope, SendOtpResponseDto } from '@quanlykhupho/shared-types';
import { apiClient, getErrorMessage } from '../../lib/api-client';

interface PhoneStepProps {
  onOtpSent: (phone: string, retryAfter: number, expiresIn: number) => void;
}

export function PhoneStep({ onOtpSent }: PhoneStepProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phoneNumber.trim().replace(/[\s\-.]/g, '');
    if (!cleanPhone) {
      setError('Vui lòng nhập số điện thoại');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.post<ApiResponseEnvelope<SendOtpResponseDto>>(
        '/auth/send-otp',
        { phoneNumber: cleanPhone },
      );
      const data = res.data.data;
      onOtpSent(cleanPhone, data.retryAfter, data.expiresIn);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 leading-tight">
          Đăng nhập hoặc Đăng ký
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Nhập số điện thoại di động của bạn để nhận mã xác thực OTP qua tin nhắn SMS.
        </p>
      </div>

      {error && (
        <Alert
          variant="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      <Input
        label="Số điện thoại"
        type="tel"
        placeholder="Ví dụ: 0912345678"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        disabled={isLoading}
        required
        autoFocus
        helperText="Định dạng số di động 10 số (Viettel, VinaPhone, MobiFone,...)"
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        isLoading={isLoading}
      >
        Gửi mã xác thực OTP
      </Button>

      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-medium text-slate-700">Lưu ý an toàn thông tin:</p>
        <p className="mt-0.5">
          Số điện thoại của bạn được hệ thống bảo vệ. Không chia sẻ mã OTP cho bất kỳ ai.
        </p>
      </div>
    </form>
  );
}
