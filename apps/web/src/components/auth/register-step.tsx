'use client';

import React, { useState } from 'react';
import { Button, Input, Select, Alert } from '@quanlykhupho/ui';
import { ApiResponseEnvelope, RegisterResponseDto, UserDto } from '@quanlykhupho/shared-types';
import { useNeighborhoods } from '../../hooks/use-neighborhoods';
import { apiClient, getErrorMessage } from '../../lib/api-client';

interface RegisterStepProps {
  registerToken: string;
  phoneNumber: string;
  onRegisteredSuccess: (user: UserDto, message: string) => void;
  onBackToPhone: () => void;
}

export function RegisterStep({
  registerToken,
  phoneNumber,
  onRegisteredSuccess,
  onBackToPhone,
}: RegisterStepProps) {
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    data: neighborhoods = [],
    isLoading: isLoadingNeighborhoods,
    isError: isNeighborhoodsError,
  } = useNeighborhoods();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }
    if (!address.trim()) {
      setError('Vui lòng nhập địa chỉ nơi cư trú');
      return;
    }
    if (!neighborhoodId) {
      setError('Vui lòng chọn Khu phố trực thuộc');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.post<ApiResponseEnvelope<RegisterResponseDto>>(
        '/auth/register',
        {
          registerToken,
          fullName: fullName.trim(),
          address: address.trim(),
          neighborhoodId,
        },
      );
      const data = res.data.data;
      onRegisteredSuccess(
        data.user,
        data.message || 'Đăng ký thành công! Hồ sơ đang chờ phê duyệt.',
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const neighborhoodOptions = neighborhoods.map((n) => ({
    value: n.id,
    label: `${n.name} - ${n.ward}, ${n.district}`,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            Bước 2: Hoàn tất thông tin cư dân
          </span>
          <button
            type="button"
            onClick={onBackToPhone}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            Hủy đăng ký
          </button>
        </div>
        <h2 className="mt-2 text-xl font-bold text-slate-900 leading-tight">
          Đăng ký thông tin Cư dân
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Số điện thoại <strong className="text-slate-900">{phoneNumber}</strong> chưa
          được đăng ký trong hệ thống. Vui lòng cung cấp thông tin để Trưởng khu phố xét duyệt.
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
        label="Họ và tên cư dân"
        placeholder="Ví dụ: Nguyễn Văn A"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        disabled={isLoading}
        required
        autoFocus
        helperText="Nhập đầy đủ họ tên có dấu theo Căn cước công dân"
      />

      <Input
        label="Địa chỉ nơi ở / Số nhà, Tên đường"
        placeholder="Ví dụ: Số 123/4 đường Nguyễn Du, Tổ 5"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={isLoading}
        required
        helperText="Địa chỉ thường trú hoặc tạm trú tại khu phố"
      />

      <Select
        label="Khu phố / Tổ dân phố trực thuộc"
        placeholder="-- Chọn khu phố của bạn --"
        options={neighborhoodOptions}
        value={neighborhoodId}
        onChange={(e) => setNeighborhoodId(e.target.value)}
        disabled={isLoading || isLoadingNeighborhoods}
        required
        helperText={
          isLoadingNeighborhoods
            ? 'Đang tải danh sách khu phố...'
            : isNeighborhoodsError
              ? 'Không tải được khu phố. Vui lòng thử lại sau.'
              : 'Trưởng khu phố tương ứng sẽ nhận hồ sơ và xét duyệt'
        }
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        isLoading={isLoading}
      >
        Gửi yêu cầu đăng ký
      </Button>

      <p className="text-center text-xs text-slate-500">
        Bằng việc gửi thông tin, bạn xác nhận các thông tin cư trú trên là hoàn toàn chính xác.
      </p>
    </form>
  );
}
