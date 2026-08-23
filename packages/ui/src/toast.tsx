import { type ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  variant?: ToastVariant;
  title?: string;
  message: string;
  onClose?: () => void;
  action?: ReactNode;
}

const toastStyles: Record<ToastVariant, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    icon: 'text-emerald-600',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    icon: 'text-red-600',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: 'text-amber-600',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    icon: 'text-blue-600',
  },
};

export function Alert({
  variant = 'info',
  title,
  message,
  onClose,
  action,
}: ToastProps) {
  const style = toastStyles[variant];

  return (
    <div
      role="alert"
      className={cn(
        'relative flex items-start gap-3 rounded-xl border p-4 text-sm transition-all',
        style.bg,
        style.border,
        style.text,
      )}
    >
      <div className={cn('mt-0.5 shrink-0', style.icon)}>
        {variant === 'success' && (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        )}
        {variant === 'error' && (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {variant === 'warning' && (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
        {variant === 'info' && (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      <div className="flex-1">
        {title && <h5 className="font-bold leading-tight">{title}</h5>}
        <p className={cn('text-sm leading-relaxed', title && 'mt-1')}>{message}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
