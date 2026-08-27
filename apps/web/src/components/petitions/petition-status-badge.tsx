'use client';

import React from 'react';
import { Badge } from '@quanlykhupho/ui';
import { PetitionCategory, PetitionStatus } from '@quanlykhupho/shared-types';
import { AppIcon } from '../app-icon';

interface PetitionStatusBadgeProps {
  status: PetitionStatus;
  className?: string;
}
export function PetitionStatusBadge({ status, className }: PetitionStatusBadgeProps) {
  switch (status) {
    case PetitionStatus.REVIEWING:
      return (
        <Badge variant="warning" className={className}>
          <AppIcon name="clock" className="h-3 w-3 inline mr-1" />
          <span>Chờ tiếp nhận</span>
        </Badge>
      );
    case PetitionStatus.PROCESSING:
      return (
        <Badge variant="info" className={className}>
          <AppIcon name="settings" className="h-3 w-3 inline mr-1" />
          <span>Đang xử lý</span>
        </Badge>
      );
    case PetitionStatus.RESOLVED:
      return (
        <Badge variant="success" className={className}>
          <AppIcon name="check" className="h-3 w-3 inline mr-1" />
          <span>Đã giải quyết</span>
        </Badge>
      );
    case PetitionStatus.REJECTED:
      return (
        <Badge variant="destructive" className={className}>
          <AppIcon name="x" className="h-3 w-3 inline mr-1" />
          <span>Bị từ chối</span>
        </Badge>
      );
    case PetitionStatus.CANCELLED:
      return (
        <Badge variant="default" className={className}>
          <AppIcon name="ban" className="h-3 w-3 inline mr-1" />
          <span>Đã hủy</span>
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
          className={`inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100 ${className || ''}`}
        >
          <AppIcon name="construction" className="h-3.5 w-3.5 inline" />
          <span>Cơ sở hạ tầng</span>
        </span>
      );
    case PetitionCategory.SANITATION:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-100 ${className || ''}`}
        >
          <AppIcon name="broom" className="h-3.5 w-3.5 inline" />
          <span>Vệ sinh môi trường</span>
        </span>
      );
    case PetitionCategory.SECURITY:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-100 ${className || ''}`}
        >
          <AppIcon name="shield" className="h-3.5 w-3.5 inline" />
          <span>An ninh trật tự</span>
        </span>
      );
    case PetitionCategory.OTHER:
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200 ${className || ''}`}
        >
          <AppIcon name="pin" className="h-3.5 w-3.5 inline" />
          <span>Khác</span>
        </span>
      );
  }
}
