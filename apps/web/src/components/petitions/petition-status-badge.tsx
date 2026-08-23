'use client';

import React from 'react';
import { Badge } from '@quanlykhupho/ui';
import { PetitionCategory, PetitionStatus } from '@quanlykhupho/shared-types';

interface PetitionStatusBadgeProps {
  status: PetitionStatus;
  className?: string;
}

export function PetitionStatusBadge({ status, className }: PetitionStatusBadgeProps) {
  switch (status) {
    case PetitionStatus.REVIEWING:
      return (
        <Badge variant="warning" className={className}>
          ⏳ Chờ tiếp nhận
        </Badge>
      );
    case PetitionStatus.PROCESSING:
      return (
        <Badge variant="info" className={className}>
          ⚙️ Đang xử lý
        </Badge>
      );
    case PetitionStatus.RESOLVED:
      return (
        <Badge variant="success" className={className}>
          ✓ Đã giải quyết
        </Badge>
      );
    case PetitionStatus.REJECTED:
      return (
        <Badge variant="destructive" className={className}>
          ✕ Bị từ chối
        </Badge>
      );
    case PetitionStatus.CANCELLED:
      return (
        <Badge variant="default" className={className}>
          ⊘ Đã hủy
        </Badge>
      );
    default:
      return (
        <Badge variant="default" className={className}>
          {status}
        </Badge>
      );
  }
}

interface PetitionCategoryBadgeProps {
  category: PetitionCategory;
  className?: string;
}

export function PetitionCategoryBadge({ category, className }: PetitionCategoryBadgeProps) {
  switch (category) {
    case PetitionCategory.INFRASTRUCTURE:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100 ${className || ''}`}
        >
          🏗️ Cơ sở hạ tầng
        </span>
      );
    case PetitionCategory.SANITATION:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100 ${className || ''}`}
        >
          🧹 Vệ sinh môi trường
        </span>
      );
    case PetitionCategory.SECURITY:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-100 ${className || ''}`}
        >
          🛡️ An ninh trật tự
        </span>
      );
    case PetitionCategory.OTHER:
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200 ${className || ''}`}
        >
          📌 Khác
        </span>
      );
  }
}
